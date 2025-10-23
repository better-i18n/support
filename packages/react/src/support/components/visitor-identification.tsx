import { useState, type FormEvent, type ReactElement } from "react";

import { useVisitor } from "../../hooks/use-visitor";
import { useSupport } from "../../provider";
import { Button } from "./button";
import { Header } from "./header";
import { Text, useSupportText } from "../text";
import { Watermark } from "./watermark";

const EMAIL_PATTERN = /[^@\s]+@[^@\s]+\.[^@\s]+/;

export function VisitorIdentification(): ReactElement {
        const { identify } = useVisitor();
        const { website, client } = useSupport();
        const text = useSupportText();
        const [email, setEmail] = useState("");
        const [name, setName] = useState("");
        const [error, setError] = useState<string | null>(null);
        const [isSubmitting, setIsSubmitting] = useState(false);

        if (!website) {
                return null;
        }

        const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                setError(null);

                const trimmedEmail = email.trim();
                if (!EMAIL_PATTERN.test(trimmedEmail)) {
                        setError(text("component.visitorIdentification.error.emailRequired"));
                        return;
                }

                setIsSubmitting(true);

                try {
                        const result = await identify({
                                email: trimmedEmail,
                                name: name.trim() || undefined,
                        });

                        if (!result) {
                                throw new Error("Identify failed");
                        }

                        const normalizedContact = {
                                id: result.contact.id,
                                name: result.contact.name,
                                email: result.contact.email ?? trimmedEmail,
                                image: result.contact.image,
                        };

                        const currentVisitor = website.visitor;

                        const updatedVisitor = currentVisitor
                                ? { ...currentVisitor, id: result.visitorId, contact: normalizedContact }
                                : {
                                          id: result.visitorId,
                                          isBlocked: false,
                                          language: null,
                                          contact: normalizedContact,
                                  };

                        client.websiteStore.setWebsite({
                                ...website,
                                visitor: updatedVisitor,
                        });
                } catch (submitError) {
                        console.error("Failed to identify visitor", submitError);
                        setError(text("component.visitorIdentification.error.generic"));
                } finally {
                        setIsSubmitting(false);
                }
        };

        return (
                <div className="flex h-full flex-col overflow-hidden">
                        <Header />

                        <div className="flex flex-1 flex-col justify-center px-6 py-8">
                                <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
                                        <div className="flex flex-col items-center gap-2 text-center">
                                                <Text
                                                        as="h2"
                                                        className="font-co-sans text-xl text-co-foreground"
                                                        textKey="component.visitorIdentification.title"
                                                />
                                                <Text
                                                        as="p"
                                                        className="text-co-primary/70 text-sm"
                                                        textKey="component.visitorIdentification.description"
                                                />
                                        </div>

                                        <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit}>
                                                <label className="flex flex-col gap-1 text-left">
                                                        <Text
                                                                as="span"
                                                                className="text-xs font-medium uppercase tracking-wide text-co-primary/60"
                                                                textKey="component.visitorIdentification.emailLabel"
                                                        />
                                                        <input
                                                                aria-describedby={
                                                                        error
                                                                                ? "cossistant-support-identify-error"
                                                                                : undefined
                                                                }
                                                                aria-invalid={error ? "true" : undefined}
                                                                autoComplete="email"
                                                                className="w-full rounded-md border border-co-border bg-transparent px-3 py-2 text-sm text-co-foreground outline-none transition focus:border-co-primary focus:ring-2 focus:ring-co-primary/20"
                                                                disabled={isSubmitting}
                                                                inputMode="email"
                                                                onChange={(event) => setEmail(event.target.value)}
                                                                placeholder={text(
                                                                        "component.visitorIdentification.emailPlaceholder"
                                                                )}
                                                                required
                                                                type="email"
                                                                value={email}
                                                        />
                                                </label>

                                                <label className="flex flex-col gap-1 text-left">
                                                        <span className="text-xs font-medium uppercase tracking-wide text-co-primary/60">
                                                                <Text textKey="component.visitorIdentification.nameLabel" />
                                                                <span className="ml-1 text-co-primary/40">
                                                                        <Text textKey="component.visitorIdentification.nameOptional" />
                                                                </span>
                                                        </span>
                                                        <input
                                                                autoComplete="name"
                                                                className="w-full rounded-md border border-co-border bg-transparent px-3 py-2 text-sm text-co-foreground outline-none transition focus:border-co-primary focus:ring-2 focus:ring-co-primary/20"
                                                                disabled={isSubmitting}
                                                                onChange={(event) => setName(event.target.value)}
                                                                placeholder={text(
                                                                        "component.visitorIdentification.namePlaceholder"
                                                                )}
                                                                type="text"
                                                                value={name}
                                                        />
                                                </label>

                                                {error && (
                                                        <p
                                                                className="text-destructive text-sm"
                                                                id="cossistant-support-identify-error"
                                                        >
                                                                {error}
                                                        </p>
                                                )}

                                                <Button
                                                        className="w-full"
                                                        disabled={isSubmitting}
                                                        type="submit"
                                                        variant="secondary"
                                                >
                                                        <Text textKey="component.visitorIdentification.submit" />
                                                </Button>
                                        </form>
                                </div>
                        </div>

                        <Watermark className="mb-4" />
                </div>
        );
}
