// Inline worker bundles also work in the standalone file:// build.
import AnalysisWorker from './analysis-worker.js?worker&inline';
export const createWorker = () => new AnalysisWorker();
