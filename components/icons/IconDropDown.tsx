export default function IconDropdown({ ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={props.size ? props.size : '24px'}
      fill="#000"
      {...props}
    >
      <path d="M7 10L12 15L17 10H7Z" />
    </svg>
  );
}