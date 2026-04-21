// Official brand icon components (Gmail, Google Calendar)
// Inline SVGs so colors render regardless of theme.

interface IconProps {
  className?: string;
  size?: number;
}

export function GmailIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-label="Gmail"
    >
      <path fill="#4285F4" d="M2 6.4v11.2c0 .77.63 1.4 1.4 1.4H5V8.5l7 5.25 7-5.25V19h1.6c.77 0 1.4-.63 1.4-1.4V6.4L12 12 2 6.4z" />
      <path fill="#34A853" d="M3.4 5h17.2c.77 0 1.4.63 1.4 1.4L12 12 2 6.4C2 5.63 2.63 5 3.4 5z" opacity=".0" />
      <path fill="#34A853" d="M5 19V8.5L2 6.4v11.2c0 .77.63 1.4 1.4 1.4H5z" />
      <path fill="#FBBC04" d="M19 19V8.5l3-2.1v11.2c0 .77-.63 1.4-1.4 1.4H19z" />
      <path fill="#EA4335" d="M5 8.5L2 6.4V6.4C2 5.63 2.63 5 3.4 5H5l7 5.25L19 5h1.6c.77 0 1.4.63 1.4 1.4l-3 2.1L12 13.75 5 8.5z" />
      <path fill="#C5221F" d="M5 5h.01L12 10.25 18.99 5H19L12 10.25 5 5z" />
    </svg>
  );
}

export function GoogleCalendarIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-label="Google Calendar"
    >
      <path fill="#fff" d="M5 5h14v14H5z" />
      <path fill="#1A73E8" d="M14.5 9.5h-5v5h5v-5z" />
      <path fill="#EA4335" d="M19 5h-4v4h4V5z" />
      <path fill="#34A853" d="M19 19v-4h-4v4h4z" />
      <path fill="#FBBC04" d="M5 19h4v-4H5v4z" />
      <path fill="#4285F4" d="M5 9h4V5H5v4z" />
      <path fill="#188038" d="M19 9h-4v4h4V9z" opacity="0" />
      <path fill="none" stroke="#DADCE0" strokeWidth="1" d="M5 5h14v14H5z" />
      <text x="12" y="16.5" textAnchor="middle" fontSize="7" fontWeight="700" fill="#1A73E8" fontFamily="Arial, sans-serif">
        {new Date().getDate()}
      </text>
    </svg>
  );
}
