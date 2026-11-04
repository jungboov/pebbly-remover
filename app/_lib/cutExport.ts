// 인쇄 파일 만들기(화면 스레드에서 글·바이트만 엮음 — 그림은 캔버스 워커가 300dpi로)
//  PDF(인쇄소): 그림 · 반칼 · 완칼을 다른 층으로. 칼선 틀 — CutContour 별색(보이는 색 M100) 0.25pt 겹쳐찍기(롤랜드 VersaWorks 계열) · M100 선 0.5pt(와우프레스) · K100 선 0.5pt(애즈랜드)
//  SVG(크리컷·잉크스케이프): mm 단위, 그림은 PNG로 안에, 칼선은 채움 없는 path
//  DXF(실루엣 무료판): R12 꺾은선, 단위 mm(DXF엔 단위가 없어 실루엣에서 '있는 그대로'로 열기) + 같은 크기 시트 PNG
//  PNG(크리컷 사진 올리기): 스티커 낱장 — 흰 테두리까지 그린 투명 PNG(300dpi). 크리컷이 바깥 가장자리를 따라 자름
import { cutArt, cutSheet } from './canvasJobs';
import { flatten, roundRect, svgPath, type Geo } from './cutline';
import { DIE_IN, DIE_R, PAPERS, type Paper, type Place } from './sheet';
import type { PdfImage } from './cutArt';

export type Format = 'pdf' | 'svg' | 'dxf' | 'png';
export type Preset = 'cutcontour' | 'm100' | 'k100';
export type ExportItem = { id: string; name: string; art: Blob; geo: Geo; size: number };
export type ExportJob = { items: ExportItem[]; pages: Place[][]; paper: Paper; die: boolean; preset: Preset; split: boolean; format: Format };
export type OutFile = { name: string; blob: Blob };

const DPI = 300;
const K = 72 / 25.4;   // mm → pt
const f3 = (v: number) => { const s = v.toFixed(3).replace(/\.?0+$/, ''); return s === '-0' || s === '' ? '0' : s; };

const LINE = {
  cutcontour: { pt: 0.25, svg: '#FF00FF', die: '#00AEEF' },
  m100: { pt: 0.5, svg: '#EC008C', die: '#EC008C' },
  k100: { pt: 0.5, svg: '#000000', die: '#000000' },
} as const;

const dieLoop = (paper: Paper) => {
  const [W, H] = PAPERS[paper];
  return roundRect(DIE_IN, DIE_IN, W - 2 * DIE_IN, H - 2 * DIE_IN, DIE_R);
};

const stamp = () => {
  const d = new Date(), p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};
const safe = (s: string) => s.replace(/\.[^/.]+$/, '').replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 40) || 'sticker';

export async function buildFiles(job: ExportJob): Promise<OutFile[]> {
  const base = `pebbly-sticker-${job.paper}-${stamp()}`;
  const byId = new Map(job.items.map(it => [it.id, it]));
  const used = job.items.filter(it => job.pages.some(pg => pg.some(p => p.id === it.id)));
  if (job.format === 'png') {
    const out: OutFile[] = [];
    for (const it of job.items) out.push({ name: `pebbly-sticker-${safe(it.name)}-${Math.round(it.size)}mm.png`, blob: await cutArt(it.art, it.geo, DPI, 'png') });
    return out;
  }
  if (job.format === 'pdf') {
    const imgs = new Map<string, PdfImage>();
    for (const it of used) imgs.set(it.id, await cutArt(it.art, it.geo, DPI, 'pdf'));
    return [{ name: `${base}.pdf`, blob: pdf(job, byId, imgs) }];
  }
  const pageName = (i: number, tail = '') => `${base}${job.pages.length > 1 ? `-p${i + 1}` : ''}${tail}`;
  if (job.format === 'svg') {
    const pngs = new Map<string, string>();
    for (const it of used) pngs.set(it.id, await b64(await cutArt(it.art, it.geo, DPI, 'svg')));
    const out: OutFile[] = [];
    job.pages.forEach((pg, i) => {
      const mk = (parts: Parts, tail: string) => out.push({ name: pageName(i, tail) + '.svg', blob: new Blob([svg(job, byId, pngs, pg, parts)], { type: 'image/svg+xml' }) });
      if (job.split) {
        mk({ art: true }, '-art');
        mk({ kiss: true }, '-kiss');
        if (job.die) mk({ die: true }, '-die');
      } else mk({ art: true, kiss: true, die: job.die }, '');
    });
    return out;
  }
  // DXF + 같은 크기 시트 PNG
  const out: OutFile[] = [];
  for (let i = 0; i < job.pages.length; i++) {
    const pg = job.pages[i];
    if (job.split) {
      out.push({ name: pageName(i, '-kiss') + '.dxf', blob: dxf(job, byId, pg, { kiss: true }) });
      if (job.die) out.push({ name: pageName(i, '-die') + '.dxf', blob: dxf(job, byId, pg, { die: true }) });
    } else out.push({ name: pageName(i) + '.dxf', blob: dxf(job, byId, pg, { kiss: true, die: job.die }) });
    const items = used.filter(it => pg.some(p => p.id === it.id)).map(it => ({ art: it.art, geo: it.geo, at: pg.filter(p => p.id === it.id).map(p => [p.x, p.y] as [number, number]) }));
    out.push({ name: pageName(i, '-print') + '.png', blob: await cutSheet(PAPERS[job.paper], items, DPI) });
  }
  return out;
}

type Parts = { art?: boolean; kiss?: boolean; die?: boolean };

async function b64(b: Blob): Promise<string> {
  const u = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

// ── SVG ──
function svg(job: ExportJob, byId: Map<string, ExportItem>, pngs: Map<string, string>, pg: Place[], parts: Parts): string {
  const [W, H] = PAPERS[job.paper], L = LINE[job.preset], sw = f3(L.pt / K);
  const ids = [...new Set(pg.map(p => p.id))], idx = (id: string) => ids.indexOf(id);
  let s = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${f3(W)}mm" height="${f3(H)}mm" viewBox="0 0 ${f3(W)} ${f3(H)}">\n<title>pebbly sticker sheet</title>\n`;
  if (parts.art) {
    s += '<defs>\n';
    for (const id of ids) {
      const g = byId.get(id)!.geo, i = idx(id);
      s += `<clipPath id="c${i}" clipPathUnits="userSpaceOnUse"><path clip-rule="evenodd" d="${svgPath(g.loops)}"/></clipPath>\n`;
      s += `<image id="a${i}" x="${f3(g.art[0])}" y="${f3(g.art[1])}" width="${f3(g.art[2])}" height="${f3(g.art[3])}" preserveAspectRatio="none" xlink:href="data:image/png;base64,${pngs.get(id)}"/>\n`;
    }
    s += '</defs>\n<g id="Art">\n';
    for (const p of pg) {
      const g = byId.get(p.id)!.geo, i = idx(p.id);
      s += `<g transform="translate(${f3(p.x)} ${f3(p.y)})"><path fill="#ffffff" fill-rule="evenodd" d="${svgPath(g.loops)}"/><g clip-path="url(#c${i})"><use xlink:href="#a${i}"/></g></g>\n`;
    }
    s += '</g>\n';
  }
  if (parts.kiss) {
    s += `<g id="${job.preset === 'cutcontour' ? 'CutContour' : 'KissCut'}" fill="none" stroke="${L.svg}" stroke-width="${sw}" stroke-linejoin="round">\n`;
    for (const p of pg) s += `<path d="${svgPath(byId.get(p.id)!.geo.loops, p.x, p.y)}"/>\n`;
    s += '</g>\n';
  }
  if (parts.die) s += `<g id="DieCut" fill="none" stroke="${L.die}" stroke-width="${sw}"><path d="${svgPath([dieLoop(job.paper)])}"/></g>\n`;
  return s + '</svg>\n';
}

// ── DXF(R12) ──
function dxf(job: ExportJob, byId: Map<string, ExportItem>, pg: Place[], parts: Parts): Blob {
  const [, H] = PAPERS[job.paper];
  const lines: string[] = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES'];
  const poly = (pts: number[], layer: string, color: number) => {
    lines.push('0', 'POLYLINE', '8', layer, '62', String(color), '66', '1', '70', '1', '10', '0', '20', '0', '30', '0');
    for (let i = 0; i < pts.length; i += 2) lines.push('0', 'VERTEX', '8', layer, '10', f3(pts[i]), '20', f3(H - pts[i + 1]), '30', '0');
    lines.push('0', 'SEQEND', '8', layer);
  };
  if (parts.kiss) for (const p of pg) for (const L of byId.get(p.id)!.geo.loops) poly(flatten(L).map((v, i) => v + (i % 2 ? p.y : p.x)), 'KISS', 6);
  if (parts.die) poly(flatten(dieLoop(job.paper)), 'DIE', 4);
  lines.push('0', 'ENDSEC', '0', 'EOF');
  return new Blob([lines.join('\n') + '\n'], { type: 'application/dxf' });
}

// ── PDF 1.5: 층(OCG) 셋 · 그림은 RGB + 투명값(SMask), 칼선 안으로 잘라(W* n) 그림 ──
function pdf(job: ExportJob, byId: Map<string, ExportItem>, imgs: Map<string, PdfImage>): Blob {
  const [PW, PH] = PAPERS[job.paper], W = PW * K, H = PH * K, L = LINE[job.preset];
  const enc = new TextEncoder(), parts: Uint8Array[] = [], xref: number[] = [];
  let off = 0;
  const put = (s: string | Uint8Array) => { const b = typeof s === 'string' ? enc.encode(s) : s; parts.push(b); off += b.length; };
  const obj = (n: number, body: string) => { xref[n] = off; put(`${n} 0 obj\n${body}\nendobj\n`); };
  const stream = (n: number, dict: string, data: Uint8Array) => { xref[n] = off; put(`${n} 0 obj\n<< ${dict} /Length ${data.length} >>\nstream\n`); put(data); put('\nendstream\nendobj\n'); };

  const ids = [...imgs.keys()];
  const imgNo = (id: string) => 10 + 2 * ids.indexOf(id);
  const pageNo = (i: number) => 10 + 2 * ids.length + 2 * i;
  const N = pageNo(job.pages.length);

  put('%PDF-1.5\n%\xE2\xE3\xCF\xD3\n');
  const ocgs = '4 0 R 5 0 R' + (job.die ? ' 6 0 R' : '');
  obj(1, `<< /Type /Catalog /Pages 2 0 R /OCProperties << /OCGs [${ocgs}] /D << /Order [${ocgs}] /ON [${ocgs}] >> >> >>`);
  obj(2, `<< /Type /Pages /Kids [${job.pages.map((_, i) => `${pageNo(i)} 0 R`).join(' ')}] /Count ${job.pages.length} >>`);
  const d = new Date(), p2 = (n: number) => String(n).padStart(2, '0');
  obj(3, `<< /Producer (pebbly remover) /Title (pebbly sticker sheet) /CreationDate (D:${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}) >>`);
  obj(4, '<< /Type /OCG /Name (Art) >>');
  obj(5, `<< /Type /OCG /Name (${job.preset === 'cutcontour' ? 'CutContour' : 'KissCut'}) >>`);
  obj(6, '<< /Type /OCG /Name (DieCut) >>');
  obj(7, '<< /Type /ExtGState /OP true /op true /OPM 1 >>');
  obj(8, '[/Separation /CutContour /DeviceCMYK << /FunctionType 2 /Domain [0 1] /C0 [0 0 0 0] /C1 [0 1 0 0] /N 1 >>]');
  obj(9, '[/Separation /DieCut /DeviceCMYK << /FunctionType 2 /Domain [0 1] /C0 [0 0 0 0] /C1 [1 0 0 0] /N 1 >>]');
  for (const id of ids) {
    const im = imgs.get(id)!, n = imgNo(id);
    stream(n, `/Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask ${n + 1} 0 R`, im.rgb);
    stream(n + 1, `/Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, im.alpha);
  }

  const X = (v: number) => f3(v * K), Y = (v: number) => f3(H - v * K);
  const path = (loops: number[][], ox: number, oy: number) => {
    let s = '';
    for (const Lp of loops) {
      s += `${X(Lp[0] + ox)} ${Y(Lp[1] + oy)} m\n`;
      for (let i = 2; i + 5 < Lp.length; i += 6) s += `${X(Lp[i] + ox)} ${Y(Lp[i + 1] + oy)} ${X(Lp[i + 2] + ox)} ${Y(Lp[i + 3] + oy)} ${X(Lp[i + 4] + ox)} ${Y(Lp[i + 5] + oy)} c\n`;
      s += 'h\n';
    }
    return s;
  };
  const kissInk = job.preset === 'cutcontour' ? '/CS0 CS 1 SCN' : job.preset === 'm100' ? '0 1 0 0 K' : '0 0 0 1 K';
  const dieInk = job.preset === 'cutcontour' ? '/CS1 CS 1 SCN' : kissInk;
  job.pages.forEach((pg, i) => {
    let c = '/OC /L0 BDC\n';
    for (const p of pg) {
      const g = byId.get(p.id)!.geo, [ax, ay, aw, ah] = g.art;
      c += `q\n${path(g.loops, p.x, p.y)}W* n\n${f3(aw * K)} 0 0 ${f3(ah * K)} ${X(p.x + ax)} ${Y(p.y + ay + ah)} cm\n/I${ids.indexOf(p.id)} Do\nQ\n`;
    }
    c += 'EMC\n/OC /L1 BDC\nq /GS0 gs ' + kissInk + ` ${L.pt} w 1 J 1 j\n`;
    for (const p of pg) c += path(byId.get(p.id)!.geo.loops, p.x, p.y);
    c += 'S\nQ\nEMC\n';
    if (job.die) c += `/OC /L2 BDC\nq /GS0 gs ${dieInk} ${L.pt} w 1 j\n${path([dieLoop(job.paper)], 0, 0)}S\nQ\nEMC\n`;
    const xo = ids.map((id, j) => `/I${j} ${imgNo(id)} 0 R`).join(' ');
    obj(pageNo(i), `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f3(W)} ${f3(H)}] /TrimBox [0 0 ${f3(W)} ${f3(H)}] /Resources << /XObject << ${xo} >> /ColorSpace << /CS0 8 0 R /CS1 9 0 R >> /ExtGState << /GS0 7 0 R >> /Properties << /L0 4 0 R /L1 5 0 R /L2 6 0 R >> >> /Contents ${pageNo(i) + 1} 0 R >>`);
    stream(pageNo(i) + 1, '', enc.encode(c));
  });
  const start = off;
  let x = `xref\n0 ${N}\n0000000000 65535 f \n`;
  for (let n = 1; n < N; n++) x += `${String(xref[n] ?? 0).padStart(10, '0')} 00000 n \n`;
  put(x + `trailer\n<< /Size ${N} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${start}\n%%EOF\n`);
  return new Blob(parts as BlobPart[], { type: 'application/pdf' });
}
