// 한/영 글자: 둘 다 그려 두고 CSS(html[lang])가 하나만 보임
export function T({ ko, en }: { ko: React.ReactNode; en: React.ReactNode }) {
  return (
    <>
      <span className="t-ko" lang="ko">{ko}</span>
      <span className="t-en" lang="en">{en}</span>
    </>
  );
}
