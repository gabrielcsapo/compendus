import { type LoaderFunctionArgs } from "react-router";
import { getBook } from "../actions/books";
import { EpubEditorShell } from "../components/editor/EpubEditorShell";

type LoaderData = Awaited<ReturnType<typeof loader>>;

export async function loader({ params }: LoaderFunctionArgs) {
  const id = params.id as string;
  const book = await getBook(id);
  if (!book) {
    throw new Response("Book not found", { status: 404 });
  }
  if (book.format !== "epub" && !book.convertedEpubPath) {
    throw new Response("Only EPUB books can be edited", { status: 400 });
  }
  return { book };
}

export default function BookEditor({ loaderData }: { loaderData: LoaderData }) {
  const { book } = loaderData;

  return (
    <EpubEditorShell
      bookId={book.id}
      bookTitle={book.title || "Untitled"}
      returnUrl={`/book/${book.id}`}
    />
  );
}
