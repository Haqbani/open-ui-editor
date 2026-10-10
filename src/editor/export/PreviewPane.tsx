export function PreviewPane({ html }: { html: string }) {
  return (
    <iframe
      className="email-preview"
      title="Email preview"
      sandbox=""
      srcDoc={html}
    />
  );
}
