import { describe, expect, it } from "bun:test";
import type * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SegmentedControl } from "./segmented-control";

function renderControl(
	props: Partial<React.ComponentProps<typeof SegmentedControl>> = {}
) {
	return renderToStaticMarkup(
		<SegmentedControl
			aria-label="Example segmented control"
			onValueChange={() => {}}
			options={[
				{ value: "one", label: "One" },
				{ value: "two", label: "Two" },
				{ value: "three", label: "Three" },
			]}
			value="one"
			{...props}
		/>
	);
}

describe("SegmentedControl", () => {
	it("renders an active indicator for the selected option", () => {
		const html = renderControl({ value: "two" });

		expect(html).toContain('data-slot="segmented-control"');
		expect(html).toContain('data-slot="segmented-control-indicator"');
		expect(html).toContain("left:calc(1 * (100% / 3) - 2px)");
		expect(html).toContain("top:-2px");
		expect(html).toContain("bottom:-2px");
		expect(html).toContain("width:calc(100% / 3 + 4px)");
		expect(html).toContain("rounded-[2px]");
		expect(html).toContain("bg-background shadow-xs");
		expect(html).toContain("overflow-visible");
		expect(html).toContain("bg-background-50");
		expect(html).not.toContain("p-1");
		expect(html).toContain('data-state="on"');
	});

	it("supports the small size variant", () => {
		const html = renderControl({ size: "sm" });

		expect(html).toContain("h-8");
		expect(html).toContain("px-2.5 text-xs");
	});

	it("disables item interaction when an option is disabled", () => {
		const html = renderControl({
			options: [
				{ value: "one", label: "One" },
				{ value: "two", label: "Two", disabled: true },
			],
		});

		expect(html).toContain(">Two<");
		expect(html).toContain('data-disabled=""');
		expect(html).toContain("disabled");
	});
});
