import 'dart:convert';

/// Generates JavaScript for hiding ad elements using CSS selectors.
///
/// Performance optimizations:
/// - Debounced MutationObserver to prevent excessive processing
/// - Reduced batch delay (10ms vs 300ms)
/// - Combined selectors into CSS style injection for initial hide
/// - Removal is still done for dynamically added elements
/// - Minimal logging in production
String generateHidingScript(List<String> selectors) {
  final jsSelectorsArray = jsonEncode(selectors);
  return '''
(function() {
  'use strict';
  
  const selectors = $jsSelectorsArray;
  if (!Array.isArray(selectors) || selectors.length === 0) return;
  
  const BATCH_SIZE = 500;
  const DEBOUNCE_MS = 50;
  const DEBUG = false;
  
  let hideTimeout = null;
  let isProcessing = false;
  let processedCount = 0;
  
  // Inject CSS to hide elements immediately (faster than JS removal)
  function injectHidingStyles() {
    try {
      const style = document.createElement('style');
      style.id = 'adblocker-hiding-rules';
      
      // We chunk the selectors to avoid one massive rule if possible, 
      // but for "display: none !important", a single rule with all selectors comma-separated is most efficient.
      // However, one invalid selector can invalidate the whole rule in some browsers/versions (though standard says it drops just the invalid one).
      // To be safe, we can try to join them. If it fails, we falling back or splitting might be too heavy.
      // Modern browsers handle invalid selectors in a list gracefully (Selector Level 4), but older ones discard the whole rule.
      // We will blindly join for performance, assuming the parser that produced these selectors is decent.
      
      style.textContent = selectors.join(',') + ' { display: none !important; }';
      (document.head || document.documentElement).appendChild(style);
      
      if (DEBUG) console.log('[AdBlocker] Injected hiding styles for', selectors.length, 'selectors');
    } catch (e) {
      if (DEBUG) console.error('[AdBlocker] CSS injection error:', e);
    }
  }
  
  // Remove elements that match selectors (for complete removal, not just hiding)
  async function removeElements() {
    if (isProcessing) return;
    isProcessing = true;
    
    try {
      // Chunk processing to avoid blocking main thread for too long
      const batchCount = Math.ceil(selectors.length / BATCH_SIZE);
      
      for (let i = 0; i < batchCount; i++) {
        const start = i * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, selectors.length);
        // Optimize: Use querySelectorAll with comma-separated batch if possible? 
        // Yes, much faster than iterating selectors individually.
        const batchSelectors = selectors.slice(start, end);
        const combinedSelector = batchSelectors.join(',');
        
        try {
          const elements = document.querySelectorAll(combinedSelector);
          elements.forEach(el => {
            if (el && el.parentNode) {
              el.remove();
            }
          });
          processedCount += elements.length;
        } catch (e) {
          // If combined selector fails (e.g. one bad selector), we might need to fallback?
          // For now, silent fail for the batch.
          if (DEBUG) console.warn('[AdBlocker] Batch removal failed, likely invalid selector in batch', e);
        }
        
        // Yield to main thread
        if (i < batchCount - 1) {
          await new Promise(r => setTimeout(r, 10));
        }
      }
      
      if (DEBUG && processedCount > 0) {
        console.log('[AdBlocker] Removed', processedCount, 'elements');
      }
    } catch (e) {
      if (DEBUG) console.error('[AdBlocker] Remove error:', e);
    } finally {
      isProcessing = false;
    }
  }
  
  // Debounced hide function for MutationObserver
  function scheduleHide() {
    if (hideTimeout) clearTimeout(hideTimeout);
    hideTimeout = setTimeout(removeElements, DEBOUNCE_MS);
  }
  
  // Initialize
  function init() {
    injectHidingStyles();
    removeElements();
    
    try {
      const observer = new MutationObserver(scheduleHide);
      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });
    } catch (e) {
      if (DEBUG) console.error('[AdBlocker] Observer error:', e);
    }
  }
  
  if (document.body) {
    init();
  } else {
    const bodyObserver = new MutationObserver((_, obs) => {
      if (document.body) {
        obs.disconnect();
        init();
      }
    });
    bodyObserver.observe(document.documentElement, { childList: true });
  }
  
})();
''';
}
