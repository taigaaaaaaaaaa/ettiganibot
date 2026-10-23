export default function Loading() {
  return (
    <div aria-live="polite" className="page-loading" role="status">
      <span aria-hidden="true" className="page-loading-spinner" />
      <span>ページを読み込み中...</span>
    </div>
  );
}
