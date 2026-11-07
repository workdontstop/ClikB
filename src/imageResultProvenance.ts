import { store } from './store';
import { recordImageResultModel } from './imageModelExamplesSlice';

export const imageModelForSource = (source: string): string | undefined => store.getState().imageModelExamples.results[source]?.model;

export function recordGeneratedImageModel(model: string, urls: Array<string | undefined>, storedUrl?: string): void {
  const sources = urls.filter((url): url is string => !!url && /^(?:blob:|https?:\/\/)/i.test(url));
  if (sources.length) store.dispatch(recordImageResultModel({ model: model === 'Models' ? 'Schnell' : model, urls: sources, storedUrl }));
}

export function inheritImageResultModel(source: string, urls: Array<string | undefined>, storedUrl?: string): void {
  const original = store.getState().imageModelExamples.results[source];
  if (original) recordGeneratedImageModel(original.model, urls, storedUrl || original.storedUrl);
}

export function imageModelsForSources(sources: Array<string | undefined>): Record<string, string> {
  const results = store.getState().imageModelExamples.results;
  return Object.fromEntries(sources.filter((url): url is string => !!url && /^https?:\/\//i.test(url))
    .flatMap(url => results[url] ? [[url, results[url].model]] : []));
}

export function collectModelExampleCandidates(sources: Array<string | undefined>): Array<{ model: string; url: string }> {
  const results = store.getState().imageModelExamples.results;
  return sources.flatMap(source => {
    if (!source) return [];
    const result = results[source];
    const url = result?.storedUrl || source;
    return result && /^https?:\/\//i.test(url) ? [{ model: result.model, url }] : [];
  });
}
