// JobScreen Diagnostic Tool
// Add this to the JobsScreen component to help debug the issue

const diagnostics = {
  logJobsState: (propJobs, internalJobs, activeJobs, loading, refreshing) => {
    console.log('=== JOBSSCREEN DIAGNOSTICS ===');
    console.log('PropJobs:', {
      available: !!propJobs,
      length: propJobs ? propJobs.length : 0,
      sample: propJobs ? propJobs.slice(0, 2).map(j => ({ id: j.id, title: j.title })) : []
    });
    console.log('Internal Jobs:', {
      length: internalJobs.length,
      sample: internalJobs.slice(0, 2).map(j => ({ id: j.id, title: j.title }))
    });
    console.log('Active Jobs (used for display):', {
      length: activeJobs.length,
      sample: activeJobs.slice(0, 2).map(j => ({ id: j.id, title: j.title }))
    });
    console.log('Loading States:', {
      loading,
      refreshing
    });
    console.log('Data Flow:', {
      usingPropJobs: propJobs && propJobs.length > 0,
      usingInternalJobs: !propJobs || propJobs.length === 0,
      hasAnyData: activeJobs.length > 0,
      shouldShowLoading: loading && activeJobs.length === 0
    });
    console.log('=== END DIAGNOSTICS ===');
  },

  logFirestoreQuery: (query, snapshot) => {
    console.log('=== FIRESTORE QUERY DIAGNOSTICS ===');
    console.log('Query:', query);
    console.log('Results:', {
      size: snapshot?.size || 0,
      empty: snapshot?.empty || true,
      docs: snapshot?.docs?.length || 0
    });
    if (snapshot?.docs?.length > 0) {
      console.log('Sample Results:', snapshot.docs.slice(0, 3).map(doc => ({
        id: doc.id,
        title: doc.data().title,
        createdAt: doc.data().createdAt
      })));
    }
    console.log('=== END FIRESTORE DIAGNOSTICS ===');
  }
};

// Usage in JobsScreen component:
// Add this line in the Debug useEffect:
// diagnostics.logJobsState(propJobs, jobs, activeJobs, loading, refreshing);

export default diagnostics;