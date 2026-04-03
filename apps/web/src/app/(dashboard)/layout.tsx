import { Support } from "@cossistant/next/support";
import { Providers } from "./providers";

export default function Layout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return <Providers>{children}</Providers>;
}
