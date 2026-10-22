import { useCallback, useEffect, useState } from 'react';
import { addTag, removeTag, getTags, getSuggestedTags, allTags, TAGS_CHANGED_EVENT } from '../lib/tags';
import type { TagTargetType } from '../lib/tags';

/** Reactive tags for a target, with add/remove helpers. */
export function useTags(targetType: TagTargetType, targetId: string) {
  const [tags, setTags] = useState<string[]>([]);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [allTagsList, setAllTagsList] = useState<string[]>([]);

  const reload = useCallback(async () => {
    setTags(await getTags(targetType, targetId));
  }, [targetType, targetId]);

  useEffect(() => {
    reload();
    getSuggestedTags().then(setSuggested).catch(() => {});
    allTags().then(setAllTagsList).catch(() => {});
  }, [reload]);

  useEffect(() => {
    window.addEventListener(TAGS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(TAGS_CHANGED_EVENT, reload);
  }, [reload]);

  const add = useCallback(async (tag: string) => {
    await addTag(targetType, targetId, tag);
    await reload();
  }, [targetType, targetId, reload]);

  const remove = useCallback(async (tag: string) => {
    await removeTag(targetType, targetId, tag);
    await reload();
  }, [targetType, targetId, reload]);

  return { tags, suggested, allTagsList, reload, add, remove };
}

/** Reactive suggested + all tags (no target). */
export function useTagCatalog() {
  const [suggested, setSuggested] = useState<string[]>([]);
  const [allTagsList, setAllTagsList] = useState<string[]>([]);

  useEffect(() => {
    getSuggestedTags().then(setSuggested).catch(() => {});
    allTags().then(setAllTagsList).catch(() => {});
  }, []);

  return { suggested, allTagsList };
}
