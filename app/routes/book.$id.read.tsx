import { type LoaderFunctionArgs } from "react-router";
import { getBook } from "../actions/books";
import { ReaderShell } from "../components/reader/ReaderShell";

type LoaderData = Awaited<ReturnType<typeof loader>>;

export async function loader({ params }: LoaderFunctionArgs) {
  const id = params.id as string;
  const book = await getBook(id);
  if (!book) {
    throw new Response("Book not found", { status: 404 });
  }
  return { book };
}

export default function BookReader({ loaderData }: { loaderData: LoaderData }) {
  const { book } = loaderData;

  return (
    <ReaderShell
      bookId={book.id}
      initialPosition={book.readingProgress || 0}
      returnUrl={`/book/${book.id}`}
    />
  );
}
