import Image from 'next/image';
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main id="main-content" className="auth-shell">
      <section className="auth-brand" aria-label="sixtyoneeighty Mail">
        <a className="wordmark" href="/login">
          sixty<span>one</span>eighty <small>MAIL</small>
        </a>
        <div className="auth-art">
          <Image
            src="/brand/sixtyoneeighty.png"
            alt="sixtyoneeighty"
            width={1445}
            height={1088}
            priority
            sizes="(max-width: 760px) 90vw, 55vw"
          />
        </div>
        <div className="auth-brand-caption">
          <span>YOUR PEOPLE. YOUR CONVERSATIONS.</span>
          <p>
            A little less noise.
            <br />A little more connection.
          </p>
        </div>
      </section>
      <section className="auth-panel">
        {children}
        <p className="auth-footer">
          sixtyoneeighty <span>/</span> A private space to connect.
        </p>
      </section>
    </main>
  );
}
