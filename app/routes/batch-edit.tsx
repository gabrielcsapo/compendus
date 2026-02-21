import { getAllBooksWithTags, getDistinctSeries, getDistinctAuthors } from "../actions/batch";
import { getTags } from "../actions/tags";
import { BatchEditClient } from "../components/BatchEditClient";

export async function loader() {
  const [{ books, bookTags }, allTags, seriesNames, authorNames] = await Promise.all([
    getAllBooksWithTags(),
    getTags(),
    getDistinctSeries(),
    getDistinctAuthors(),
  ]);
  return { books, bookTags, allTags, seriesNames, authorNames };
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

export default function BatchEdit({ loaderData }: { loaderData: LoaderData }) {
  return <BatchEditClient {...loaderData} />;
}
