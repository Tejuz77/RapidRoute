/**
 * Booking Worker — Worker thread for CPU-intensive booking tasks.
 *
 * Runs in a separate thread via Node.js worker_threads.
 * Handles: SEND_CONFIRMATION_EMAIL, GENERATE_TICKET_PDF, UPDATE_ANALYTICS
 *
 * Worker thread pool — offloads CPU-bound tasks from the main event loop to parallel threads.
 * Each worker runs independently and communicates via postMessage.
 */

const { parentPort, workerData } = require('worker_threads');

const workerId = workerData?.workerId ?? 'unknown';

console.log(`[BookingWorker-${workerId}] Worker thread started`);

/**
 * Simulate sending a confirmation email.
 * In production, this would call an email service API.
 */
async function sendConfirmationEmail(bookingId) {
  // Simulate CPU-bound work (email template rendering, SMTP connection)
  const startTime = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));

  // Generate a fake email body to simulate template rendering
  const emailBody = `
    <h1>Booking Confirmed!</h1>
    <p>Your booking (ID: ${bookingId}) has been confirmed.</p>
    <p>Thank you for choosing RapidRoute.</p>
  `;

  console.log(`[BookingWorker-${workerId}] Confirmation email sent for booking ${bookingId} (${Date.now() - startTime}ms)`);

  return {
    success: true,
    task: 'SEND_CONFIRMATION_EMAIL',
    bookingId,
    emailBodyLength: emailBody.length,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Simulate generating a ticket PDF.
 * In production, this would use a PDF library like pdfkit or puppeteer.
 */
async function generateTicketPdf(bookingId) {
  const startTime = Date.now();
  // Simulate CPU-intensive PDF generation
  await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));

  // Simulate generating ticket data
  const ticketData = {
    bookingId,
    generatedAt: new Date().toISOString(),
    qrCodeData: `RAPIDROUTE-${bookingId}-${Date.now()}`,
    pdfSize: Math.floor(50000 + Math.random() * 200000),
  };

  console.log(`[BookingWorker-${workerId}] Ticket PDF generated for booking ${bookingId} (${Date.now() - startTime}ms)`);

  return {
    success: true,
    task: 'GENERATE_TICKET_PDF',
    bookingId,
    ...ticketData,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Simulate updating analytics data.
 */
async function updateAnalytics(bookingId, routeId) {
  const startTime = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));

  console.log(`[BookingWorker-${workerId}] Analytics updated for booking ${bookingId}, route ${routeId} (${Date.now() - startTime}ms)`);

  return {
    success: true,
    task: 'UPDATE_ANALYTICS',
    bookingId,
    routeId,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Handle incoming tasks from the main thread.
 */
parentPort.on('message', async (task) => {
  console.log(`[BookingWorker-${workerId}] Received task: ${task.type} for booking ${task.bookingId || task.data?.bookingId || 'unknown'}`);

  try {
    let result;

    switch (task.type) {
      case 'SEND_CONFIRMATION_EMAIL':
        result = await sendConfirmationEmail(task.bookingId);
        break;

      case 'GENERATE_TICKET_PDF':
        result = await generateTicketPdf(task.bookingId);
        break;

      case 'UPDATE_ANALYTICS':
        result = await updateAnalytics(task.bookingId, task.routeId);
        break;

      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }

    parentPort.postMessage({
      task: task.type,
      bookingId: task.bookingId,
      result,
      status: 'completed',
    });
  } catch (error) {
    console.error(`[BookingWorker-${workerId}] Task failed: ${task.type} — ${error.message}`);

    parentPort.postMessage({
      task: task.type,
      bookingId: task.bookingId,
      error: error.message,
      status: 'failed',
    });
  }
});

// Signal that the worker is ready
parentPort.postMessage({ status: 'ready', workerId });
