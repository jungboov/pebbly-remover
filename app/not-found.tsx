import Link from 'next/link';
import { T } from './_components/T';

export default function NotFound() {
  return (
    <main className="nf">
      <p className="nf-no">[ 404 ]</p>
      <p><T ko="없는 페이지예요" en="This page doesn't exist" /></p>
      <Link className="btn" href="/"><T ko="pebbly remover로" en="Back to pebbly remover" /></Link>
    </main>
  );
}
