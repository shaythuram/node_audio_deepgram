const captions = window.document.getElementById("captions");

async function getMicrophone() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return new MediaRecorder(stream);
  } catch (error) {
    console.error("Error accessing microphone:", error);
    throw error;
  }
}

async function openMicrophone(microphone, socket) {
  return new Promise((resolve) => {
    microphone.onstart = () => {
      console.log("WebSocket connection opened");
      document.body.classList.add("recording");
      resolve();
    };

    microphone.onstop = () => {
      console.log("WebSocket connection closed");
      document.body.classList.remove("recording");
    };

    microphone.ondataavailable = (event) => {
      if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
        socket.send(event.data);
      }
    };

    microphone.start(1000);
  });
}

async function closeMicrophone(microphone) {
  microphone.stop();
}

async function start(socket) {
  const listenButton = document.querySelector("#record");
  let microphone;

  console.log("client: waiting to open microphone");

  listenButton.addEventListener("click", async () => {
    if (!microphone) {
      try {
        microphone = await getMicrophone();
        await openMicrophone(microphone, socket);
      } catch (error) {
        console.error("Error opening microphone:", error);
      }
    } else {
      await closeMicrophone(microphone);
      microphone = undefined;
    }
  });
}

window.addEventListener("load", () => {
  const socket = new WebSocket("ws://localhost:3100");

  socket.addEventListener("open", async () => {
    console.log("WebSocket connection opened");
    await start(socket);
  });

  socket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    console.log(data);
    if (data.channel && data.channel.alternatives && data.channel.alternatives[0]) {
      const alternative = data.channel.alternatives[0];
      if (alternative.transcript !== "") {
        // Format transcript with speaker labels
        let formattedTranscript = alternative.transcript;
        
        if (alternative.words && alternative.words.length > 0) {
          // Group words by speaker
          const speakerGroups = {};
          alternative.words.forEach(word => {
            if (word.speaker !== undefined) {
              if (!speakerGroups[word.speaker]) {
                speakerGroups[word.speaker] = [];
              }
              speakerGroups[word.speaker].push(word.word);
            }
          });
          
          // Format with speaker labels
          formattedTranscript = Object.entries(speakerGroups)
            .map(([speaker, words]) => `Speaker ${speaker}: ${words.join(' ')}`)
            .join('\n');
        }
        
        captions.innerHTML = `<span>${formattedTranscript}</span>`;
      }
    }
  });

  socket.addEventListener("close", () => {
    console.log("WebSocket connection closed");
  });
});
