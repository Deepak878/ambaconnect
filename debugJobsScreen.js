// JobScreen Diagnostic Tool
// Add this to the JobsScreen component to help debug the issue

const diagnostics = {
  logJobsState: (propJobs, internalJobs, activeJobs, loading, refreshing) => ({
    propJobs: {
      available: !!propJobs,
      length: propJobs ? propJobs.length : 0,
      sample: propJobs ? propJobs.slice(0, 2).map(j => ({ id: j.id, title: j.title })) : []
    },
    internalJobs: {
      length: internalJobs.length,
      sample: internalJobs.slice(0, 2).map(j => ({ id: j.id, title: j.title }))
    },
    activeJobs: {
      length: activeJobs.length,
      sample: activeJobs.slice(0, 2).map(j => ({ id: j.id, title: j.title }))
    },
    loadingStates: {
      loading,
      refreshing
    },
    dataFlow: {
      usingPropJobs: propJobs && propJobs.length > 0,
      usingInternalJobs: !propJobs || propJobs.length === 0,
      hasAnyData: activeJobs.length > 0,
      shouldShowLoading: loading && activeJobs.length === 0
    }
  }),

  logFirestoreQuery: (query, snapshot) => ({
    query,
    results: {
      size: snapshot?.size || 0,
      empty: snapshot?.empty || true,
      docs: snapshot?.docs?.length || 0
    },
    sample: snapshot?.docs?.length > 0
      ? snapshot.docs.slice(0, 3).map(doc => ({
          id: doc.id,
          title: doc.data().title,
          createdAt: doc.data().createdAt
        }))
      : []
  })
};

// Usage in JobsScreen component:
// Add this line in the Debug useEffect:
// diagnostics.logJobsState(propJobs, jobs, activeJobs, loading, refreshing);

export default diagnostics;