import { getUserProfile } from '@/lib/db/queries';
import { ArrowUpRight, MapPin } from 'lucide-react';

export async function RightSidebar({ userId }: { userId: number }) {
  const user = await getUserProfile(userId);
  return (
    <aside className="profile-sidebar">
      <h2>Your workspace</h2>
      {user ? (
        <>
          <div className="profile-identity">
            <span className="avatar large">
              {user.firstName?.[0]}
              {user.lastName?.[0]}
            </span>
            <div>
              <h3>
                {user.firstName} {user.lastName}
              </h3>
              <p>{user.email}</p>
            </div>
          </div>
          <dl className="profile-facts">
            <div>
              <dt>Role</dt>
              <dd>{user.jobTitle || '—'}</dd>
            </div>
            <div>
              <dt>Team</dt>
              <dd>{user.company || '—'}</dd>
            </div>
            {user.location && (
              <div>
                <dt>
                  <MapPin size={14} /> Location
                </dt>
                <dd>{user.location}</dd>
              </div>
            )}
          </dl>
          <section className="recent-section">
            <h2>Recent conversations</h2>
            {user.latestThreads.map((thread, i) => (
              <div className="recent-thread" key={i}>
                <span className="recent-dot" />
                <p>{thread.subject || '(No subject)'}</p>
              </div>
            ))}
            {!user.latestThreads.length && (
              <p className="muted">No conversations yet.</p>
            )}
          </section>
          <div className="profile-links">
            {[
              ['LinkedIn', user.linkedin],
              ['X / Twitter', user.twitter],
              ['GitHub', user.github],
            ].map(
              ([label, url]) =>
                url && (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {label}
                    <ArrowUpRight size={14} />
                  </a>
                ),
            )}
          </div>
        </>
      ) : (
        <div className="profile-empty">
          <span className="avatar large">61</span>
          <h3>Make room for good conversations.</h3>
          <p>
            Your profile and recent conversations will appear here once your
            mailbox is connected.
          </p>
        </div>
      )}
      <div className="profile-footer">
        sixty<span>one</span>eighty <span className="footer-divider">/</span>{' '}
        mail
      </div>
    </aside>
  );
}
