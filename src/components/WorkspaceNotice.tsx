"use client";

interface WorkspaceNoticeProps {
  notice: string | null;
  feedbackError: string | null;
}

export function WorkspaceNotice({ notice, feedbackError }: WorkspaceNoticeProps) {
  return (
    <>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {feedbackError && (
        <p className="inline-error" role="alert">
          {feedbackError}
        </p>
      )}
    </>
  );
}
