"use client";

import React, { type ReactElement } from "react";

import { Button } from "../../primitives/button";
import { cn } from "../utils";

const DOCS_URL = "https://cossistant.com/docs";

export type SupportUnavailableProps = {
        className?: string;
        position?: "top" | "bottom";
        align?: "right" | "left";
        mode?: "floating" | "responsive";
        errorMessage?: string;
};

export function SupportUnavailable({
        className,
        position = "bottom",
        align = "right",
        mode = "floating",
        errorMessage,
}: SupportUnavailableProps): ReactElement {
        const wrapperClasses = cn(
                "cossistant",
                {
                        "fixed z-[9999]": mode === "floating",
                        "bottom-4": mode === "floating" && position === "bottom",
                        "top-4": mode === "floating" && position === "top",
                        "right-4": mode === "floating" && align === "right",
                        "left-4": mode === "floating" && align === "left",
                        "relative h-full w-full": mode === "responsive",
                },
                className
        );

        const panelClasses = cn(
                "flex h-full w-full flex-col items-center justify-center bg-co-background text-center",
                mode === "floating"
                        ? "max-md:fixed max-md:inset-0 max-md:bg-co-background md:relative md:aspect-[9/18] md:max-h-[calc(100vh-6rem)] md:w-[400px] md:rounded-lg md:border md:border-dashed md:border-co-border md:shadow-xl"
                        : "md:relative md:h-full md:w-full md:rounded-none md:border-0 md:shadow-none"
        );

        return (
                <div className={wrapperClasses}>
                        <div className={panelClasses}>
                                <div className="mx-auto flex w-full max-w-xs flex-col items-center justify-center space-y-4 px-6 py-12">
                                        <div className="space-y-2">
                                                <h2 className="text-base font-semibold text-co-foreground">
                                                        No public key found
                                                </h2>
                                                <p className="text-sm text-co-muted-foreground">
                                                        Add your Cossistant public key to finish configuring the widget. This
                                                        notice only appears in local development.
                                                </p>
                                                {errorMessage ? (
                                                        <p className="text-xs text-co-muted-foreground/80">
                                                                {errorMessage}
                                                        </p>
                                                ) : null}
                                        </div>
                                        <Button
                                                asChild
                                                className="inline-flex items-center justify-center rounded-md border border-co-border bg-co-primary px-4 py-2 text-sm font-medium text-co-primary-foreground shadow-sm transition-colors hover:bg-co-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-co-ring focus-visible:ring-offset-2 focus-visible:ring-offset-co-background"
                                        >
                                                <a href={DOCS_URL} rel="noreferrer" target="_blank">
                                                        View documentation
                                                </a>
                                        </Button>
                                </div>
                        </div>
                </div>
        );
}
