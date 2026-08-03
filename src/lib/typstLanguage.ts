import { StreamLanguage, type StreamParser, type StringStream } from "@codemirror/language";

// A lightweight hand-rolled tokenizer for Typst — not a full grammar, just
// enough markup/code-mode recognition to make the template editor readable.
// Token names below are @lezer/highlight `tags` keys (see StreamParser.token
// docs); CodeMirror's default/oneDark highlight styles already have rules
// for all of them.

const KEYWORDS = new Set([
  "let",
  "set",
  "show",
  "import",
  "include",
  "if",
  "else",
  "for",
  "while",
  "return",
  "break",
  "continue",
  "in",
  "not",
  "and",
  "or",
  "none",
  "auto",
  "true",
  "false",
  "as",
  "context",
]);

type State = { inBlockComment: boolean };

const parser: StreamParser<State> = {
  name: "typst",
  startState(): State {
    return { inBlockComment: false };
  },
  token(stream: StringStream, state: State): string | null {
    if (state.inBlockComment) {
      if (stream.match(/^[^*]*\*\//)) {
        state.inBlockComment = false;
      } else {
        stream.skipToEnd();
      }
      return "comment";
    }

    if (stream.match("/*")) {
      state.inBlockComment = true;
      return "comment";
    }
    if (stream.match("//")) {
      stream.skipToEnd();
      return "comment";
    }

    // Markup heading: "=", "==", ... at the start of a line.
    if (stream.sol() && stream.match(/^=+(?=\s|$)/)) {
      stream.skipToEnd();
      return "heading";
    }

    if (stream.match(/^"([^"\\]|\\.)*"?/)) {
      return "string";
    }

    // Inline math, e.g. $x^2$ — deliberately simple (no nested $ handling).
    if (stream.match(/^\$[^$]*\$?/)) {
      return "atom";
    }

    // Raw/code span, e.g. `code`
    if (stream.match(/^`([^`\\]|\\.)*`?/)) {
      return "monospace";
    }

    // Label, e.g. <intro>
    if (stream.match(/^<[\w:-]+>/)) {
      return "labelName";
    }

    // Citation/reference, e.g. @smith2020
    if (stream.match(/^@[\w:-]+/)) {
      return "link";
    }

    // "#" enters code mode — highlight the sigil itself as a keyword marker.
    if (stream.match(/^#/)) {
      return "keyword";
    }

    if (stream.match(/^-?\d+(\.\d+)?(%|pt|em|cm|mm|in|fr|deg|rad)?/)) {
      return "number";
    }

    if (stream.match(/^[a-zA-Z_][\w-]*/)) {
      return KEYWORDS.has(stream.current()) ? "keyword" : null;
    }

    if (stream.match(/^\*[^*\n]+\*/)) {
      return "strong";
    }
    if (stream.match(/^_[^_\n]+_/)) {
      return "emphasis";
    }

    stream.next();
    return null;
  },
};

export const typstLanguage = StreamLanguage.define(parser);
