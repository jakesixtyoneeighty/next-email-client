'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state">
      <h1>Mail couldn’t load.</h1>
      <p>Please check your connection and try again.</p>
      <button className="secondary-button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
