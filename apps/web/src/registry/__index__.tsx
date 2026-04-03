/** biome-ignore-all lint/suspicious/noExplicitAny: Ok here :) */
import * as React from "react";

export const Index: Record<
	string,
	{
		name: string;
		component: React.LazyExoticComponent<React.ComponentType<any>>;
		demoComponent?: React.LazyExoticComponent<React.ComponentType<any>>;
		path: string;
	}
> = {
	support: {
		name: "support",
		component: React.lazy(() => import("@/components/support")),
		demoComponent: React.lazy(
			() => import("@/components/support/demo-landing")
		),
		path: "src/components/support/index.tsx",
	},
	"support-doc": {
		name: "support-doc",
		component: React.lazy(() => import("@/components/support/demo-doc")),
		demoComponent: React.lazy(() => import("@/components/support/demo-doc")),
		path: "src/components/support/demo-doc/index.tsx",
	},
};
