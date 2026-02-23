// Background service worker
let currentUtterance = null;
let isPlaying = false;
let currentText = '';
let currentPosition = 0;
let voices = [];

// Initialize when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu
  chrome.contextMenus.create({
    id: 'read-selection',
    title: 'Read selected text',
    contexts: ['selection']
  });
  
  chrome.contextMenus.create({
    id: 'read-page',
    title: 'Read entire page',
    contexts: ['page']
  });
  
  // Load available voices
  loadVoices();
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'read-selection' && info.selectionText) {
    startReading(info.selectionText, tab.id);
  } else if (info.menuItemId === 'read-page') {
    chrome.tabs.sendMessage(tab.id, { action: 'getPageText' }, (response) => {
      if (response && response.text) {
        startReading(response.text, tab.id);
      }
    });
  }
});

// Handle keyboard commands
chrome.commands.onCommand.addListener((command) => {
  switch(command) {
    case 'play-pause':
      togglePlayPause();
      break;
    case 'stop':
      stopReading();
      break;
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch(request.action) {
    case 'startReading':
      startReading(request.text, sender.tab?.id);
      sendResponse({ success: true });
      break;
      
    case 'stopReading':
      stopReading();
      sendResponse({ success: true });
      break;
      
    case 'pauseReading':
      pauseReading();
      sendResponse({ success: true });
      break;
      
    case 'resumeReading':
      resumeReading();
      sendResponse({ success: true });
      break;
      
    case 'getVoices':
      sendResponse({ voices: voices });
      break;
      
    case 'getStatus':
      sendResponse({ 
        isPlaying: isPlaying,
        currentText: currentText,
        currentPosition: currentPosition
      });
      break;
      
    case 'updatePosition':
      currentPosition = request.position;
      if (isPlaying) {
        resumeFromPosition();
      }
      sendResponse({ success: true });
      break;
  }
  
  return true;
});

function loadVoices() {
  // Chrome's TTS API doesn't have a direct way to get voices
  // We'll use a predefined list of common voices
  voices = [
    { name: 'Google UK English Female', lang: 'en-GB' },
    { name: 'Google UK English Male', lang: 'en-GB' },
    { name: 'Google US English', lang: 'en-US' },
    { name: 'Google Deutsch', lang: 'de-DE' },
    { name: 'Google Español', lang: 'es-ES' },
    { name: 'Google Français', lang: 'fr-FR' },
    { name: 'Google Italiano', lang: 'it-IT' },
    { name: 'Google Português do Brasil', lang: 'pt-BR' }
  ];
}

function startReading(text, tabId) {
  stopReading();
  
  currentText = text;
  currentPosition = 0;
  
  // Get settings from storage
  chrome.storage.sync.get(['rate', 'pitch', 'voice'], (settings) => {
    const options = {
      rate: settings.rate || 1.0,
      pitch: settings.pitch || 1.0,
      lang: 'en-US',
      voiceName: settings.voice || 'Google US English'
    };
    
    // Split text into chunks for better control
    const chunks = splitTextIntoChunks(text, 200);
    currentText = chunks;
    currentPosition = 0;
    
    speakNextChunk(options, tabId);
  });
}

function splitTextIntoChunks(text, maxLength) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks = [];
  let currentChunk = '';
  
  sentences.forEach(sentence => {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += sentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    }
  });
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

function speakNextChunk(options, tabId) {
  if (currentPosition >= currentText.length) {
    stopReading();
    return;
  }
  
  const chunk = currentText[currentPosition];
  
  chrome.tts.speak(chunk, {
    ...options,
    onEvent: (event) => {
      switch(event.type) {
        case 'start':
          isPlaying = true;
          updateUI({ isPlaying: true, position: currentPosition });
          break;
          
        case 'end':
          currentPosition++;
          if (currentPosition < currentText.length) {
            speakNextChunk(options, tabId);
          } else {
            stopReading();
          }
          break;
          
        case 'error':
          console.error('TTS Error:', event.errorMessage);
          stopReading();
          break;
      }
    }
  });
  
  // Highlight current chunk in the page
  if (tabId) {
    chrome.tabs.sendMessage(tabId, { 
      action: 'highlightText', 
      chunk: chunk,
      position: currentPosition 
    });
  }
}

function stopReading() {
  chrome.tts.stop();
  isPlaying = false;
  currentText = '';
  currentPosition = 0;
  updateUI({ isPlaying: false });
}

function pauseReading() {
  chrome.tts.pause();
  isPlaying = false;
  updateUI({ isPlaying: false });
}

function resumeReading() {
  chrome.tts.resume();
  isPlaying = true;
  updateUI({ isPlaying: true });
}

function resumeFromPosition() {
  chrome.tts.stop();
  
  if (currentPosition < currentText.length) {
    const remainingText = currentText.slice(currentPosition).join(' ');
    
    chrome.storage.sync.get(['rate', 'pitch', 'voice'], (settings) => {
      const options = {
        rate: settings.rate || 1.0,
        pitch: settings.pitch || 1.0,
        lang: 'en-US',
        voiceName: settings.voice || 'Google US English'
      };
      
      chrome.tts.speak(remainingText, {
        ...options,
        onEvent: (event) => {
          if (event.type === 'end') {
            stopReading();
          }
        }
      });
      
      isPlaying = true;
      updateUI({ isPlaying: true, position: currentPosition });
    });
  }
}

function updateUI(status) {
  chrome.runtime.sendMessage({ action: 'updateStatus', ...status });
}