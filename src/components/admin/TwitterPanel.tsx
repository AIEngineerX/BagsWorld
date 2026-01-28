"use client";

import { useState } from "react";
import {
  useTwitterStatus,
  useTwitterHistory,
  usePostTweet,
  useGenerateShillContent,
  type Tweet,
} from "@/hooks/useElizaAgents";

interface TwitterPanelProps {
  addLog?: (message: string, type?: "info" | "success" | "error") => void;
}

export function TwitterPanel({ addLog }: TwitterPanelProps) {
  const { data: status, isLoading: statusLoading, error: statusError, refetch: refetchStatus } = useTwitterStatus();
  const { data: history, refetch: refetchHistory } = useTwitterHistory(20);

  const postTweet = usePostTweet();
  const generateShill = useGenerateShillContent();

  const [tweetContent, setTweetContent] = useState("");
  const [shillMint, setShillMint] = useState("");
  const [generatedTemplates, setGeneratedTemplates] = useState<string[]>([]);

  const handlePost = async () => {
    if (!tweetContent.trim()) {
      addLog?.("Tweet content is empty", "error");
      return;
    }

    if (tweetContent.length > 280) {
      addLog?.("Tweet exceeds 280 character limit", "error");
      return;
    }

    addLog?.("Posting tweet...", "info");
    const result = await postTweet.mutateAsync(tweetContent);

    if (result.success) {
      addLog?.(`Tweet posted: ${result.message}`, "success");
      setTweetContent("");
      refetchHistory();
    } else {
      addLog?.(`Failed to post: ${result.error}`, "error");
    }
  };

  const handleGenerateShill = async () => {
    if (!shillMint.trim()) {
      addLog?.("Enter a token mint or symbol", "error");
      return;
    }

    addLog?.("Generating shill content...", "info");

    const isMint = shillMint.length > 30;
    const result = await generateShill.mutateAsync(
      isMint ? { mint: shillMint } : { symbol: shillMint }
    );

    if (result.success && result.templates) {
      addLog?.(`Generated ${result.templates.length} templates for ${result.token?.symbol}`, "success");
      setGeneratedTemplates(result.templates);
    } else {
      addLog?.(`Failed to generate: ${result.error}`, "error");
      setGeneratedTemplates([]);
    }
  };

  const applyTemplate = (template: string) => {
    setTweetContent(template);
    setGeneratedTemplates([]);
  };

  const formatCooldown = (seconds: number) => {
    if (seconds <= 0) return "Ready";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  if (statusLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-16 bg-gray-700 rounded" />
        <div className="h-32 bg-gray-700 rounded" />
      </div>
    );
  }

  if (statusError) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 p-3">
        <p className="font-pixel text-[9px] text-red-400">
          Failed to load Twitter status
        </p>
        <p className="font-pixel text-[8px] text-gray-500 mt-1">
          {statusError instanceof Error ? statusError.message : "Connection error"}
        </p>
        <button
          onClick={() => refetchStatus()}
          className="font-pixel text-[8px] text-red-400 hover:text-red-300 mt-2"
        >
          [RETRY]
        </button>
      </div>
    );
  }

  const twitter = status?.twitter;
  const stats = status?.stats;
  const canPost = twitter?.canPost || false;
  const isDryRun = twitter?.dryRun || false;

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className={`p-3 border ${twitter?.authenticated ? "bg-blue-500/10 border-blue-500/30" : "bg-yellow-500/10 border-yellow-500/30"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full ${twitter?.authenticated ? "bg-blue-400" : "bg-yellow-400"}`} />
            <div>
              <p className="font-pixel text-[10px] text-white">
                {twitter?.username || "Finn (Twitter)"}
              </p>
              <div className="flex items-center gap-2">
                {isDryRun && (
                  <span className="font-pixel text-[7px] text-yellow-400 bg-yellow-500/20 px-1">
                    DRY RUN
                  </span>
                )}
                {!twitter?.authenticated && (
                  <span className="font-pixel text-[7px] text-yellow-400 bg-yellow-500/20 px-1">
                    NOT CONFIGURED
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="font-pixel text-[8px] text-gray-400">
              Total Posts: {stats?.totalPosts || 0}
            </p>
            <p className={`font-pixel text-[8px] ${canPost ? "text-green-400" : "text-yellow-400"}`}>
              {canPost ? "Ready to post" : `Cooldown: ${formatCooldown(twitter?.nextPostInSeconds || 0)}`}
            </p>
          </div>
        </div>
      </div>

      {/* Compose Tweet */}
      <div className="bg-bags-darker p-3 border border-gray-700">
        <p className="font-pixel text-[8px] text-gray-400 mb-2">COMPOSE TWEET</p>

        <div className="relative">
          <textarea
            value={tweetContent}
            onChange={(e) => setTweetContent(e.target.value)}
            placeholder="What's happening in the Bags ecosystem?"
            className="w-full bg-black/50 border border-gray-700 px-2 py-2 font-mono text-[10px] text-white placeholder-gray-600 resize-none h-24"
            maxLength={280}
          />
          <div className="absolute bottom-2 right-2">
            <span className={`font-pixel text-[8px] ${tweetContent.length > 280 ? "text-red-400" : tweetContent.length > 250 ? "text-yellow-400" : "text-gray-500"}`}>
              {tweetContent.length}/280
            </span>
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <button
            onClick={handlePost}
            disabled={postTweet.isPending || !canPost || tweetContent.length === 0 || tweetContent.length > 280}
            className="font-pixel text-[8px] text-blue-400 hover:text-blue-300 bg-blue-500/10 px-3 py-1.5 border border-blue-500/30 disabled:opacity-50"
          >
            {postTweet.isPending ? "[POSTING...]" : isDryRun ? "[POST (DRY RUN)]" : "[POST TWEET]"}
          </button>
          <button
            onClick={() => setTweetContent("")}
            className="font-pixel text-[8px] text-gray-400 hover:text-gray-300 px-2 py-1.5 border border-gray-600"
          >
            [CLEAR]
          </button>
        </div>
      </div>

      {/* Shill Generator */}
      <div className="bg-bags-darker p-3 border border-bags-gold/30">
        <p className="font-pixel text-[8px] text-gray-400 mb-2">SHILL CONTENT GENERATOR</p>

        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={shillMint}
            onChange={(e) => setShillMint(e.target.value)}
            placeholder="Token mint or symbol..."
            className="flex-1 bg-black/50 border border-gray-700 px-2 py-1 font-mono text-[10px] text-white placeholder-gray-600"
          />
          <button
            onClick={handleGenerateShill}
            disabled={generateShill.isPending || !shillMint.trim()}
            className="font-pixel text-[8px] text-bags-gold hover:text-yellow-300 bg-yellow-500/10 px-2 py-1 border border-yellow-500/30 disabled:opacity-50"
          >
            {generateShill.isPending ? "[...]" : "[GENERATE]"}
          </button>
        </div>

        {generatedTemplates.length > 0 && (
          <div className="space-y-2 mt-3">
            <p className="font-pixel text-[7px] text-gray-500">Click to use template:</p>
            {generatedTemplates.map((template, i) => (
              <button
                key={i}
                onClick={() => applyTemplate(template)}
                className="w-full text-left bg-black/30 p-2 border border-gray-700 hover:border-gray-500"
              >
                <p className="font-mono text-[8px] text-gray-300 whitespace-pre-wrap">
                  {template}
                </p>
                <p className="font-pixel text-[6px] text-gray-500 mt-1">
                  {template.length}/280 chars
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Post History */}
      <div className="bg-bags-darker p-3 border border-gray-700">
        <div className="flex justify-between items-center mb-2">
          <p className="font-pixel text-[8px] text-gray-400">POST HISTORY</p>
          <button
            onClick={() => refetchHistory()}
            className="font-pixel text-[7px] text-gray-500 hover:text-gray-300"
          >
            [REFRESH]
          </button>
        </div>

        {history?.posts && history.posts.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {history.posts.map((tweet) => (
              <TweetCard key={tweet.id} tweet={tweet} />
            ))}
          </div>
        ) : (
          <p className="font-pixel text-[9px] text-gray-500 text-center py-4">
            No posts yet
          </p>
        )}
      </div>

      {/* Configuration Note */}
      {!twitter?.authenticated && !isDryRun && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 p-3">
          <p className="font-pixel text-[8px] text-yellow-400 mb-1">CONFIGURATION REQUIRED</p>
          <p className="font-pixel text-[7px] text-gray-400">
            Set TWITTER_BEARER_TOKEN env var to enable real posting, or set TWITTER_DRY_RUN=true for testing.
          </p>
        </div>
      )}
    </div>
  );
}

// Tweet card subcomponent
function TweetCard({ tweet }: { tweet: Tweet }) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <div className="bg-black/30 p-2 border border-gray-700">
      <p className="font-mono text-[9px] text-gray-300 whitespace-pre-wrap">
        {tweet.text}
      </p>
      <div className="flex justify-between items-center mt-1">
        <p className="font-pixel text-[6px] text-gray-500">
          {formatDate(tweet.createdAt)}
        </p>
        {tweet.url && (
          <a
            href={tweet.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-pixel text-[7px] text-blue-400 hover:text-blue-300"
          >
            [VIEW]
          </a>
        )}
      </div>
    </div>
  );
}

export default TwitterPanel;
