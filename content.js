// Content script for interacting with web pages

// Listen for messages from popup and background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch(request.action) {
    case 'getSelectedText':
      const selectedText = window.getSelection().toString();
      sendResponse({ text: selectedText });
      break;
      
    case 'getPageText':
      // Get main content text (excluding scripts, styles, etc.)
      const pageText = extractMainContent();
      sendResponse({ text: pageText });
      break;
      
    case 'highlightText':
      highlightText(request.chunk, request.position);
      sendResponse({ success: true });
      break;
  }
  
  return true;
});

function extractMainContent() {
  // Remove script and style elements
  const elements = document.body.getElementsByTagName('*');
  const textContent = [];
  
  for (let element of elements) {
    const style = window.getComputedStyle(element);
    if (style.display !== 'none' && style.visibility !== 'hidden') {
      const text = element.innerText;
      if (text && text.trim().length > 0) {
        // Check if it's likely main content (not navigation, ads, etc.)
        if (isMainContent(element)) {
          textContent.push(text);
        }
      }
    }
  }
  
  return textContent.join(' ').replace(/\s+/g, ' ').trim();
}

function isMainContent(element) {
  // Simple heuristic to identify main content
  const excludeTags = ['SCRIPT', 'STYLE', 'NAV', 'HEADER', 'FOOTER', 'ASIDE'];
  const excludeClasses = ['ad', 'advertisement', 'sidebar', 'comment', 'menu', 'nav'];
  
  if (excludeTags.includes(element.tagName)) {
    return false;
  }
  
  const className = element.className.toLowerCase();
  for (let excludeClass of excludeClasses) {
    if (className.includes(excludeClass)) {
      return false;
    }
  }
  
  return true;
}

function highlightText(text, position) {
  // Remove previous highlights
  removeHighlights();
  
  // Create highlight element
  const highlight = document.createElement('mark');
  highlight.className = 'tts-highlight';
  highlight.style.backgroundColor = 'yellow';
  highlight.style.transition = 'background-color 0.3s';
  
  // Find and highlight the text (simplified approach)
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        if (node.parentElement.tagName === 'SCRIPT' || 
            node.parentElement.tagName === 'STYLE') {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  let found = false;
  while (walker.nextNode() && !found) {
    const node = walker.currentNode;
    const nodeText = node.textContent;
    
    if (nodeText.includes(text)) {
      const range = document.createRange();
      range.setStart(node, nodeText.indexOf(text));
      range.setEnd(node, nodeText.indexOf(text) + text.length);
      
      const newHighlight = highlight.cloneNode();
      range.surroundContents(newHighlight);
      
      // Scroll to highlight
      newHighlight.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      
      found = true;
    }
  }
  
  // Fade out highlight after a delay
  setTimeout(() => {
    const highlights = document.querySelectorAll('.tts-highlight');
    highlights.forEach(el => {
      el.style.backgroundColor = 'transparent';
    });
  }, 2000);
}

function removeHighlights() {
  const highlights = document.querySelectorAll('.tts-highlight');
  highlights.forEach(el => {
    const parent = el.parentNode;
    parent.replaceChild(document.createTextNode(el.textContent), el);
    parent.normalize();
  });
}