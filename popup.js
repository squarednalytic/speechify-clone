document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const playBtn = document.getElementById('playBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const stopBtn = document.getElementById('stopBtn');
  const voiceSelect = document.getElementById('voiceSelect');
  const rateRange = document.getElementById('rateRange');
  const rateValue = document.getElementById('rateValue');
  const pitchRange = document.getElementById('pitchRange');
  const pitchValue = document.getElementById('pitchValue');
  const customText = document.getElementById('customText');
  const readCustomBtn = document.getElementById('readCustomBtn');
  const statusText = document.getElementById('statusText');
  
  // Load saved settings
  loadSettings();
  
  // Load available voices
  loadVoices();
  
  // Get current status
  getStatus();
  
  // Event Listeners
  playBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getSelectedText' }, (response) => {
        if (response && response.text) {
          startReading(response.text);
        } else {
          // If no text selected, get page text
          chrome.tabs.sendMessage(tabs[0].id, { action: 'getPageText' }, (response) => {
            if (response && response.text) {
              startReading(response.text);
            }
          });
        }
      });
    });
  });
  
  pauseBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'pauseReading' });
    updateStatus('Paused');
  });
  
  stopBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'stopReading' });
    updateStatus('Stopped');
  });
  
  readCustomBtn.addEventListener('click', () => {
    if (customText.value.trim()) {
      startReading(customText.value);
    }
  });
  
  rateRange.addEventListener('input', (e) => {
    rateValue.textContent = e.target.value + 'x';
    saveSettings();
  });
  
  pitchRange.addEventListener('input', (e) => {
    pitchValue.textContent = e.target.value;
    saveSettings();
  });
  
  voiceSelect.addEventListener('change', saveSettings);
  
  function loadVoices() {
    chrome.runtime.sendMessage({ action: 'getVoices' }, (response) => {
      if (response && response.voices) {
        response.voices.forEach(voice => {
          const option = document.createElement('option');
          option.value = voice.name;
          option.textContent = `${voice.name} (${voice.lang})`;
          voiceSelect.appendChild(option);
        });
      }
    });
  }
  
  function loadSettings() {
    chrome.storage.sync.get(['rate', 'pitch', 'voice'], (settings) => {
      if (settings.rate) {
        rateRange.value = settings.rate;
        rateValue.textContent = settings.rate + 'x';
      }
      
      if (settings.pitch) {
        pitchRange.value = settings.pitch;
        pitchValue.textContent = settings.pitch;
      }
      
      if (settings.voice) {
        voiceSelect.value = settings.voice;
      }
    });
  }
  
  function saveSettings() {
    chrome.storage.sync.set({
      rate: parseFloat(rateRange.value),
      pitch: parseFloat(pitchRange.value),
      voice: voiceSelect.value
    });
  }
  
  function startReading(text) {
    chrome.storage.sync.get(['rate', 'pitch', 'voice'], (settings) => {
      chrome.runtime.sendMessage({ 
        action: 'startReading', 
        text: text,
        settings: settings
      });
      updateStatus('Playing...');
    });
  }
  
  function getStatus() {
    chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
      if (response && response.isPlaying) {
        updateStatus('Playing...');
      }
    });
  }
  
  function updateStatus(message) {
    statusText.textContent = message;
  }
  
  // Listen for status updates from background
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'updateStatus') {
      if (request.isPlaying) {
        updateStatus('Playing...');
      } else {
        updateStatus('Paused');
      }
    }
  });
});