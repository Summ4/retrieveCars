import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";

const apiId = 27493204;
const apiHash = "f79b28f301f619ee005c846811b73c30";
const stringSession = new StringSession(
  "1AgAOMTQ5LjE1NC4xNjcuNTABu0GHQSgpbhs5Nc3VRyPxAQI+UYKSMyEiEOcZqatutV1eJsm9UAdqwhQRPWtOvNgBPlbyxTZtUuOIkqATA4WAwBl4oExCjaK+d86ckkp92pVUmyRcplLkmhW7od3bGfEEB/jMF0/XOMJ5Ye1ddHl/I5S3NptvzTxvjhIHlFZ3qoQPI5ZiRs9k2c29YHcZsvORpcsws91lpOUed0BsOXymHFY4MNzufn8d6+4RDQw+87qbEBDf2dwfx6x/G0wUAJ+suZsOh0GDP15aH6C18su8CASZUU9n66naaOlY/2+C/vJ5zcghMt6ivB5sVjfiS/PyWqVrHUX/JsEuOkiFW4UL+jw="
);

(async () => {
  console.log("Loading interactive example...");
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });
  await client.start({
    phoneNumber: async () => await input.text("Please enter your number: "),
    password: async () => await input.text("Please enter your password: "),
    phoneCode: async () =>
      await input.text("Please enter the code you received: "),
    onError: (err) => console.log(err),
  });
  console.log("You should now be connected.");

  const offsetDate = new Date();
    offsetDate.setMinutes(offsetDate.getMinutes() - 1);

    // Convert offsetDate to Unix timestamp (milliseconds since the Unix epoch)
    const offsetTimestamp = Math.floor(offsetDate.getTime() / 1000);
  // Define the function to fetch and forward messages
 // const fetchAndForwardMessages = async () => {
    const msgs = await client.getMessages("baraholka_tbi", {
      search: "куплю ковер",
      offsetDate: 40
    });

    // const msgs2 = await client.getMessages("baraholka_tbi", {
    //   search: "legion",
    //   offsetDate: 40
    // });

    // const msgs3 = await client.getMessages("baraholka_tbi", {
    //   search: "rtx 4060",
    //   offsetDate: 40
    // });

    //const msgs = msgs1.concat(msgs2).concat(msgs3);

    console.log("the total number of msgs are", msgs.total);
    console.log("what we got is ", msgs.length);

    for (const msg of msgs) {
      const result = await client.invoke(
        new Api.messages.ForwardMessages({
          fromPeer: msg.peerId.channelId,
          id: [msg.id],
          randomId: [msg.id],
          toPeer: "Daviy",
        })
      );
    }
  //};

  // Run the function initially and then every 30 seconds
  //fetchAndForwardMessages();
  //setInterval(fetchAndForwardMessages, 30 * 100); // 30 seconds
})();
