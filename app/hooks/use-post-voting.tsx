import { useEffect, useState } from 'react';
import { href, useFetcher, useParams } from 'react-router';
import type { Post } from '~/db/schema';

export const usePostVoting = (userVotes: any[]) => {
  // Optimistic voting with local state for instant feedback
  const [pendingVotes, setPendingVotes] = useState<Record<string, 'up' | 'down' | null>>({});
  const voteFetcher = useFetcher();
  const experienceId = useParams().experienceId;

  // Clear pending votes when action completes
  useEffect(() => {
    if (voteFetcher.state === 'idle') {
      // Small delay to ensure optimistic update is visible
      setTimeout(() => {
        setPendingVotes({});
      }, 100);
    }
  }, [voteFetcher.state]);

  const handleVoteClick = (postId: string, voteType: 'up' | 'down') => {
    // Prevent multiple concurrent requests
    if (voteFetcher.state === 'submitting') {
      return;
    }

    // Set optimistic state immediately
    const currentUserVote = userVotes.find((v) => v.postId === postId)?.voteType;

    let newPendingVote: 'up' | 'down' | null;
    if (currentUserVote === voteType) {
      // User is unvoting
      newPendingVote = null;
    } else {
      // User is voting or changing vote
      newPendingVote = voteType;
    }

    setPendingVotes((prev) => ({ ...prev, [postId]: newPendingVote }));

    // Submit the actual vote
    const formData = new FormData();
    formData.append('intent', 'vote');
    formData.append('postId', postId);
    formData.append('voteType', voteType);

    voteFetcher.submit(formData, {
      method: 'post',
      action: href('/experiences/:experienceId/api/actions', { experienceId: experienceId || '' })
    });
  };

  const getOptimisticVoteCounts = (post: Post) => {
    const pendingVote = pendingVotes[post.id];
    let upvotes = post.upvotes;
    let downvotes = post.downvotes;

    if (pendingVote !== undefined) {
      const currentUserVote = userVotes.find((v) => v.postId === post.id)?.voteType;

      if (pendingVote === null) {
        // Undo vote
        if (currentUserVote === 'up') upvotes -= 1;
        else if (currentUserVote === 'down') downvotes -= 1;
      } else if (currentUserVote === pendingVote) {
        // This shouldn't happen in normal flow, but handle it
      } else if (currentUserVote && currentUserVote !== pendingVote) {
        // Changing vote
        if (currentUserVote === 'up') upvotes -= 1;
        else downvotes -= 1;
        if (pendingVote === 'up') upvotes += 1;
        else downvotes += 1;
      } else {
        // New vote
        if (pendingVote === 'up') upvotes += 1;
        else downvotes += 1;
      }
    }

    return { upvotes, downvotes };
  };

  const getUserVoteState = (postId: string) => {
    const pendingVote = pendingVotes[postId];
    if (pendingVote !== undefined) return pendingVote;

    const userVote = userVotes.find((v) => v.postId === postId);
    return userVote?.voteType || null;
  };

  return {
    handleVoteClick,
    getOptimisticVoteCounts,
    getUserVoteState,
    voteFetcher
  };
};
