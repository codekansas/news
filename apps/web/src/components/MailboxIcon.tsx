export const MailboxIcon = ({ unread }: { unread: boolean }) => (
  <svg
    aria-hidden="true"
    className="mailbox-icon"
    fill="none"
    height="12"
    viewBox="0 0 16 12"
    width="16"
  >
    <path
      d="M1 1.5h14v9H1z"
      fill={unread ? '#ff6600' : '#f6f6ef'}
      stroke="currentColor"
      strokeWidth="1"
    />
    <path d="m1.5 2 6.5 4.75L14.5 2" stroke="currentColor" strokeWidth="1" />
  </svg>
);
