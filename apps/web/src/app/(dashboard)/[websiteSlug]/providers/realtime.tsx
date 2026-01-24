"use client";

import {
	type RealtimeEventHandlersMap,
	useRealtime,
} from "@cossistant/next/realtime";
import { useQueryNormalizer } from "@normy/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useMemo } from "react";
import { useUserSession, useWebsite } from "@/contexts/website";
import { useTRPC } from "@/lib/trpc/client";
import { handleConversationCreated } from "./events/handlers/conversation-created";
import { handleConversationSeen } from "./events/handlers/conversation-seen";
import { handleConversationTyping } from "./events/handlers/conversation-typing";
import { handleConversationUpdated } from "./events/handlers/conversation-updated";
import {
	handleCrawlCompleted,
	handleCrawlFailed,
	handleCrawlPageCompleted,
	handleCrawlPagesDiscovered,
	handleCrawlProgress,
	handleCrawlStarted,
	handleLinkSourceUpdated,
} from "./events/handlers/crawl-progress";
import { handleMessageCreated } from "./events/handlers/timeline-item-created";
import {
	handleTrainingCompleted,
	handleTrainingFailed,
	handleTrainingProgress,
	handleTrainingStarted,
} from "./events/handlers/training-progress";
import { handleVisitorIdentified } from "./events/handlers/visitor-identified";
import type { DashboardRealtimeContext } from "./events/types";

export function Realtime({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();
	const queryNormalizer = useQueryNormalizer();
	const website = useWebsite();
	const { user } = useUserSession();
	const trpc = useTRPC();

	const presenceQueryOptions = useMemo(
		() =>
			trpc.visitor.listOnline.queryOptions({
				websiteSlug: website.slug,
			}),
		[trpc, website.slug]
	);

	const realtimeContext = useMemo<DashboardRealtimeContext>(
		() => ({
			queryClient,
			queryNormalizer,
			website: {
				id: website.id,
				slug: website.slug,
			},
			userId: user?.id ?? null,
		}),
		[queryClient, queryNormalizer, website.id, website.slug, user?.id]
	);

	const events = useMemo<RealtimeEventHandlersMap<DashboardRealtimeContext>>(
		() => ({
			conversationCreated: [
				(_data, meta) => {
					handleConversationCreated({
						event: meta.event,
						context: meta.context,
					});
				},
			],
			timelineItemCreated: [
				(_data, meta) => {
					handleMessageCreated({
						event: meta.event,
						context: meta.context,
					});
				},
			],
			conversationSeen: [
				(_data, meta) => {
					void handleConversationSeen({
						event: meta.event,
						context: meta.context,
					});
				},
			],
			conversationTyping: [
				(_data, meta) => {
					handleConversationTyping({
						event: meta.event,
						context: meta.context,
					});
				},
			],
			conversationUpdated: [
				(_data, meta) => {
					handleConversationUpdated({
						event: meta.event,
						context: meta.context,
					});
				},
			],
			visitorIdentified: [
				(_data, meta) => {
					handleVisitorIdentified({
						event: meta.event,
						context: meta.context,
					});
				},
			],
			visitorConnected: [
				(_data, meta) => {
					void meta.context.queryClient.invalidateQueries({
						queryKey: presenceQueryOptions.queryKey,
					});
				},
			],
			visitorDisconnected: [
				(_data, meta) => {
					void meta.context.queryClient.invalidateQueries({
						queryKey: presenceQueryOptions.queryKey,
					});
				},
			],
			// Web crawling events
			crawlStarted: [
				(_data, meta) => {
					handleCrawlStarted({
						event: meta.event,
						context: meta.context,
					});
				},
			],
			crawlProgress: [
				(_data, meta) => {
					handleCrawlProgress({
						event: meta.event,
						context: meta.context,
					});
				},
			],
			crawlCompleted: [
				(_data, meta) => {
					handleCrawlCompleted({
						event: meta.event,
						context: meta.context,
					});
				},
			],
			crawlFailed: [
				(_data, meta) => {
					handleCrawlFailed({
						event: meta.event,
						context: meta.context,
					});
				},
			],
			linkSourceUpdated: [
				(_data, meta) => {
					handleLinkSourceUpdated({
						event: meta.event,
						context: meta.context,
					});
				},
			],
			crawlPagesDiscovered: [
				(_data, meta) => {
					handleCrawlPagesDiscovered({
						event: meta.event,
						context: meta.context,
					});
				},
			],
			crawlPageCompleted: [
				(_data, meta) => {
					handleCrawlPageCompleted({
						event: meta.event,
						context: meta.context,
					});
				},
			],
			// AI training events
			trainingStarted: [
				(_data, meta) => {
					handleTrainingStarted({
						event: meta.event,
						context: meta.context,
					});
				},
			],
			trainingProgress: [
				(_data, meta) => {
					handleTrainingProgress({
						event: meta.event,
						context: meta.context,
					});
				},
			],
			trainingCompleted: [
				(_data, meta) => {
					handleTrainingCompleted({
						event: meta.event,
						context: meta.context,
					});
				},
			],
			trainingFailed: [
				(_data, meta) => {
					handleTrainingFailed({
						event: meta.event,
						context: meta.context,
					});
				},
			],
		}),
		[presenceQueryOptions.queryKey]
	);

	useRealtime<DashboardRealtimeContext>({
		context: realtimeContext,
		websiteId: website.id,
		events,
		onEventError: (error, event) => {
			console.error("[DashboardRealtime] handler failed", {
				error,
				eventType: event.type,
			});
		},
	});

	return children;
}
