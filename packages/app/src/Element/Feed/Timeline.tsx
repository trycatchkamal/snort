import "./Timeline.css";
import { FormattedMessage } from "react-intl";
import { useCallback, useMemo, useState } from "react";
import { TaggedNostrEvent, EventKind } from "@snort/system";

import { dedupeByPubkey, findTag } from "@/SnortUtils";
import useTimelineFeed, { TimelineFeed, TimelineSubject } from "@/Feed/TimelineFeed";
import useModeration from "@/Hooks/useModeration";
import { LiveStreams } from "@/Element/LiveStreams";
import { unixNow } from "@snort/shared";
import { TimelineRenderer } from "@/Element/Feed/TimelineRenderer";
import { DisplayAs, DisplayAsSelector } from "@/Element/Feed/DisplayAsSelector";
import useLogin from "@/Hooks/useLogin";

export interface TimelineProps {
  postsOnly: boolean;
  subject: TimelineSubject;
  method: "TIME_RANGE" | "LIMIT_UNTIL";
  ignoreModeration?: boolean;
  window?: number;
  now?: number;
  loadMore?: boolean;
  noSort?: boolean;
  displayAs?: DisplayAs;
  showDisplayAsSelector?: boolean;
}

/**
 * A list of notes by "subject"
 */
const Timeline = (props: TimelineProps) => {
  const login = useLogin();
  const feedOptions = useMemo(() => {
    return {
      method: props.method,
      window: props.window,
      now: props.now,
    };
  }, [props]);
  const feed: TimelineFeed = useTimelineFeed(props.subject, feedOptions);
  const displayAsInitial = props.displayAs ?? login.feedDisplayAs ?? "list";
  const [displayAs, setDisplayAs] = useState<DisplayAs>(displayAsInitial);

  const { muted, isEventMuted } = useModeration();
  const filterPosts = useCallback(
    (nts: readonly TaggedNostrEvent[]) => {
      const a = [...nts.filter(a => a.kind !== EventKind.LiveEvent)];
      props.noSort || a.sort((a, b) => b.created_at - a.created_at);
      return a
        ?.filter(a => (props.postsOnly ? !a.tags.some(b => b[0] === "e") : true))
        .filter(a => props.ignoreModeration || !isEventMuted(a));
    },
    [props.postsOnly, muted, props.ignoreModeration],
  );

  const mainFeed = useMemo(() => {
    return filterPosts(feed.main ?? []);
  }, [feed, filterPosts]);
  const latestFeed = useMemo(() => {
    return filterPosts(feed.latest ?? []).filter(a => !mainFeed.some(b => b.id === a.id));
  }, [feed, filterPosts]);
  const liveStreams = useMemo(() => {
    return (feed.main ?? []).filter(a => a.kind === EventKind.LiveEvent && findTag(a, "status") === "live");
  }, [feed]);

  const latestAuthors = useMemo(() => {
    return dedupeByPubkey(latestFeed).map(e => e.pubkey);
  }, [latestFeed]);

  function onShowLatest(scrollToTop = false) {
    feed.showLatest();
    if (scrollToTop) {
      window.scrollTo(0, 0);
    }
  }

  return (
    <>
      <LiveStreams evs={liveStreams} />
      <DisplayAsSelector
        show={props.showDisplayAsSelector}
        activeSelection={displayAs}
        onSelect={(displayAs: DisplayAs) => setDisplayAs(displayAs)}
      />
      <TimelineRenderer
        frags={[
          {
            events: mainFeed,
            refTime: mainFeed.at(0)?.created_at ?? unixNow(),
          },
        ]}
        related={feed.related ?? []}
        latest={latestAuthors}
        showLatest={t => onShowLatest(t)}
        displayAs={displayAs}
      />
      {(props.loadMore === undefined || props.loadMore === true) && (
        <div className="flex items-center">
          <button type="button" onClick={() => feed.loadMore()}>
            <FormattedMessage defaultMessage="Load more" id="00LcfG" />
          </button>
        </div>
      )}
    </>
  );
};
export default Timeline;
