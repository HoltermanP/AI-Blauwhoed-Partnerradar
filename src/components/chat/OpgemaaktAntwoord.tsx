"use client";
// Chatantwoord in Markdown als nette HTML: kopjes, opsommingen, tabellen (GFM). Ruwe HTML wordt niet doorgelaten.
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function OpgemaaktAntwoord({ tekst }: { tekst: string }) {
  return (
    <div className="chatOpmaak">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target={href?.startsWith("/") ? undefined : "_blank"} rel="noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="tabelWrap">
              <table className="tabel">{children}</table>
            </div>
          )
        }}
      >
        {tekst}
      </ReactMarkdown>
    </div>
  );
}
