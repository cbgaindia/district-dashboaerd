import { SVGProps } from 'react';

interface Props extends SVGProps<SVGSVGElement> {}

const Folder = (props: Props) => (
  <svg
    focusable="false"
    viewBox="0 0 24 24"
    width={props.width ? props.width : '24px'}
    fill="#5f6368"
    {...props}
  >
    <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-5 3c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm4 8h-8v-1c0-1.33 2.67-2 4-2s4 .67 4 2v1z"></path>
  </svg>
);

export { Folder };
