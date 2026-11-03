// 로고(pebbly labs 넘버링): 세로 스파인 00 [ 01 ] 02 | 점선 | pebbly remover | 꺾쇠 ┐┘ — 모두 MuseoModerno
// 누르면 연구소(pebblylabs.com, [ 00 ] 인트로 → 메인)로
export function Brand() {
  return (
    <a className="brand" href="https://pebblylabs.com" aria-label="pebbly labs">
      <span className="spine" aria-hidden="true"><i>00</i><b>[ 01 ]</b><i>02</i></span>
      <i className="stitch" aria-hidden="true" />
      <span className="brand-name">pebbly remover</span>
      <i className="corner" aria-hidden="true" />
    </a>
  );
}
