import express from "express";
import axios from "axios";
import nodemailer from "nodemailer";

const app = express();
app.use(express.json());

const { WEBHOOK_VERIFY_TOKEN, GRAPH_API_TOKEN, PORT } = process.env;

app.post("/webhook", async (req, res) => {
  console.log("Incoming webhook message:", JSON.stringify(req.body, null, 2));

  // check if the webhook request contains a message
  // details on WhatsApp text message payload: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples#text-messages
  const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];

  // check if the incoming message contains text
  if (message?.type === "text") {
    // extract the business number to send the reply from it
    const business_phone_number_id =
      req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;

    if (message.text.body === "1") {
      try {
        const response = await axios.get(
          "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc"
        );
        const weatherData = response.data;

        const temperature = weatherData.temperature.data[0].value;
        const humidity = weatherData.humidity.data[0].value;
        const rainfall = weatherData.rainfall.data[0].max;

        const replyMessage = `温度：${temperature}\n湿度：${humidity}\n降雨量：${rainfall}`;

        await axios({
          method: "POST",
          url: `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
          headers: {
            Authorization: `Bearer ${GRAPH_API_TOKEN}`,
          },
          data: {
            messaging_product: "whatsapp",
            to: message.from,
            text: { body: replyMessage },
            context: {
              message_id: message.id,
            },
          },
        });
      } catch (error) {
        console.error("获取天气数据时出错：", error);
      }
    }
    if (message.text.body === "2") {
      const transporter = nodemailer.createTransport({
        service: "Gmail",
        auth: {
          user: "tsot7477@gmail.com", // 發送郵件的帳號
          pass: "kinnam1A.", // 發送郵件的密碼
        },
      });
      const sendEmail = async (to, subject, body) => {
        try {
          // 發送郵件
          await transporter.sendMail({
            from: "tsot7477@gmail.com", // 發送者的電子郵件地址
            to: to, // 接收者的電子郵件地址
            subject: subject, // 郵件主題
            text: body, // 郵件內容
          });

          console.log("郵件已成功發送");
        } catch (error) {
          console.error("郵件發送失敗：", error);
        }
      };
      try {
        sendEmail("tsot7477@gmail.com", "郵件", "有人要聯絡我們");
        await axios({
          method: "POST",
          url: `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
          headers: {
            Authorization: `Bearer ${GRAPH_API_TOKEN}`,
          },
          data: {
            messaging_product: "whatsapp",
            to: message.from,
            text: { body: "可直接發出電子郵件至:\ntsot7477@gmail.com" },
            context: {
              message_id: message.id,
            },
          },
        });
      } catch (error) {
        console.error("郵件發送失敗：", error);
      }
    }

    // send a reply message as per the docs here https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
      headers: {
        Authorization: `Bearer ${GRAPH_API_TOKEN}`,
      },
      data: {
        messaging_product: "whatsapp",
        to: message.from,
        text: {
          body: "\n如想查看今日香港天氣請發 :1" + "\n如想聯絡我們請發 :2",
        },
        context: {
          message_id: message.id, // shows the message as a reply to the original user message
        },
      },
    });

    // mark incoming message as read
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
      headers: {
        Authorization: `Bearer ${GRAPH_API_TOKEN}`,
      },
      data: {
        messaging_product: "whatsapp",
        status: "read",
        message_id: message.id,
      },
    });
  }

  res.sendStatus(200);
});

// accepts GET requests at the /webhook endpoint. You need this URL to setup webhook initially.
// info on verification request payload: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  // check the mode and token sent are correct
  if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
    // respond with 200 OK and challenge token from the request
    res.status(200).send(challenge);
    console.log("Webhook verified successfully!");
  } else {
    // respond with '403 Forbidden' if verify tokens do not match
    res.sendStatus(403);
  }
});

app.get("/", (req, res) => {
  res.send(`<pre>Nothing to see here.
Checkout README.md to start.</pre>`);
});

app.listen(PORT, () => {
  console.log(`Server is listening on port: ${PORT}`);
});
