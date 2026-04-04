import { LoginForm } from "@/app/(lander-docs)/components/login-form";
import { utilityNoindex } from "@/lib/metadata";

export const dynamic = "force-dynamic";

export const metadata = utilityNoindex({
	title: "Sign in",
	path: "/login",
});

export default function LoginPage() {
	return (
		<div className="flex h-screen w-full items-center justify-center">
			<div className="flex w-full max-w-md items-center justify-center px-4">
				<LoginForm />
			</div>
		</div>
	);
}
