import { CenterMessage } from "@/components/bits";
import { TableScreen } from "@/components/TableScreen";
import { cleanTableCode } from "@/lib/types";

/** The page behind every table's QR code. */
export default async function TablePage({ params, searchParams }: PageProps<"/t/[code]">) {
  const table = cleanTableCode((await params).code);
  const { menu } = await searchParams;
  if (!table) {
    return <CenterMessage>This QR code is not for a table here. Please ask the staff for help.</CenterMessage>;
  }
  return <TableScreen table={table} forced={menu === "easy" || menu === "normal" ? menu : null} />;
}
