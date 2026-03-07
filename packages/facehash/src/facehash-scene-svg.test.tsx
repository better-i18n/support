import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
	computeFacehash,
	createFacehashScene,
	FACE_TYPES,
	type FaceType,
} from "./core";
import { FacehashSceneSvg } from "./facehash-scene-svg";

function findNameForFaceType(faceType: FaceType): string {
	for (let index = 0; index < 200; index += 1) {
		const candidate = `facehash-${index}`;
		if (computeFacehash({ name: candidate }).faceType === faceType) {
			return candidate;
		}
	}

	throw new Error(`No candidate found for face type: ${faceType}`);
}

function renderSvgMarkup(
	name: string,
	options: {
		intensity3d?: "none" | "subtle" | "medium" | "dramatic";
		pose?: "seed" | "front";
	} = {}
) {
	const scene = createFacehashScene({
		name,
		intensity3d: options.intensity3d ?? "dramatic",
		pose: options.pose ?? "seed",
	});

	return renderToStaticMarkup(
		<FacehashSceneSvg
			backgroundColor="#ec4899"
			height={128}
			idPrefix={`snapshot-${name}-${options.pose ?? "seed"}-${options.intensity3d ?? "dramatic"}`}
			scene={scene}
			showInitial
			variant="gradient"
			width={128}
		/>
	);
}

describe("FacehashSceneSvg snapshots", () => {
	for (const faceType of FACE_TYPES) {
		it(`renders ${faceType} in seeded pose`, () => {
			const name = findNameForFaceType(faceType);
			expect(renderSvgMarkup(name, { pose: "seed" })).toMatchSnapshot();
		});
	}

	for (const faceType of FACE_TYPES) {
		it(`renders ${faceType} in front pose`, () => {
			const name = findNameForFaceType(faceType);
			expect(renderSvgMarkup(name, { pose: "front" })).toMatchSnapshot();
		});
	}

	for (const intensity3d of ["none", "subtle", "medium", "dramatic"] as const) {
		it(`renders projection preset ${intensity3d}`, () => {
			expect(renderSvgMarkup("agent-47", { intensity3d })).toMatchSnapshot();
		});
	}
});
