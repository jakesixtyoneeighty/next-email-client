import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="empty-state">
      <h1>Conversation not found.</h1>
      <p>It may have moved, or this link is no longer available.</p>
      <Link href="/f/inbox" className="secondary-button">
        Back to inbox
      </Link>
    </div>
  );
}
