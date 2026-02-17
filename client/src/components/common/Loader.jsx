export default function Loader({ label = 'Loading…' }) {
  return <div aria-busy="true">{label}</div>;
}
