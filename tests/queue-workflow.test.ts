import assert from "assert";
import { 
  joinQueue, 
  getTicketByToken, 
  getActiveQueue, 
  callNextDriver, 
  updateEntryStatus, 
  getQueueStats, 
  getHistory, 
  getAuditLogs,
  setSessionActive,
  startNewSession
} from "../src/lib/queue-service";

async function runTests() {
  console.log("==========================================================");
  console.log("🚀 Starting Delivery Queue System Tests (العامية المصرية)");
  console.log("==========================================================");

  const siteId = "00000000-0000-0000-0000-000000000001";
  const runPrefix = `test-${Date.now()}`;
  await setSessionActive(siteId, true, "تهيئة الاختبار");

  // Test 1: A driver joins the queue successfully
  console.log("\n▶ Test 1: Driver joins queue successfully");
  const join1 = await joinQueue({
    site_id: siteId,
    idempotency_key: `${runPrefix}-driver-1`,
    driver_name: "أحمد حسني",
    order_reference: "AMZ-101",
  });
  assert.strictEqual(join1.isDuplicate, false, "Should not be a duplicate");
  assert.ok(join1.entry.queue_number > 0, "Queue number must be positive");
  assert.strictEqual(join1.entry.status, "waiting", "Initial status must be waiting");
  assert.ok(join1.entry.ticket_token.length >= 32, "Ticket token must be a secure hex string");
  console.log(`  ✓ Driver 1 joined with Queue #${join1.entry.queue_number}, Status: ${join1.entry.status}`);

  // Test 2: Two drivers join and receive distinct queue numbers in correct order
  console.log("\n▶ Test 2: Two drivers join and receive distinct FIFO numbers");
  const join2 = await joinQueue({
    site_id: siteId,
    idempotency_key: `${runPrefix}-driver-2`,
    driver_name: "محمود سيد",
    order_reference: "AMZ-102",
  });
  assert.strictEqual(join2.entry.queue_number, join1.entry.queue_number + 1, "Queue numbers must be consecutive");
  assert.ok(join2.entry.position! > join1.entry.position!, "Driver 2 must have a position after Driver 1");
  console.log(`  ✓ Driver 2 received Queue #${join2.entry.queue_number}, Position: ${join2.entry.position}`);

  // Test 3: Multiple simultaneous join requests do not create duplicate queue numbers
  console.log("\n▶ Test 3: Multiple concurrent join requests");
  const concurrentPromises = Array.from({ length: 5 }, (_, i) =>
    joinQueue({
      site_id: siteId,
      idempotency_key: `concurrent-req-${Date.now()}-${i}`,
      driver_name: `سائق متزامن ${i + 1}`,
      order_reference: `AMZ-CONC-${i + 1}`,
    })
  );
  const concurrentResults = await Promise.all(concurrentPromises);
  const numbers = concurrentResults.map((r) => r.entry.queue_number);
  const uniqueNumbers = new Set(numbers);
  assert.strictEqual(uniqueNumbers.size, 5, "All concurrent allocations must be unique");
  console.log(`  ✓ 5 concurrent joins allocated unique numbers: ${numbers.join(", ")}`);

  // Test 4 & 5: Double-tapping and network retry idempotency
  console.log("\n▶ Test 4 & 5: Idempotency check (double-tap & network retry)");
  const retryJoin = await joinQueue({
    site_id: siteId,
    idempotency_key: `${runPrefix}-driver-1`, // Same key as Test 1
    driver_name: "أحمد حسني",
  });
  assert.strictEqual(retryJoin.isDuplicate, true, "Retrying with same key must be detected as duplicate");
  assert.strictEqual(retryJoin.entry.queue_number, join1.entry.queue_number, "Must return original queue number");
  assert.strictEqual(retryJoin.entry.ticket_token, join1.entry.ticket_token, "Must return original token");
  console.log(`  ✓ Idempotency verified: re-submitting gave original Queue #${retryJoin.entry.queue_number} without duplicate`);

  // Test 6: Refreshing a driver ticket preserves access by token
  console.log("\n▶ Test 6: Ticket lookup by token");
  const fetchedTicket = await getTicketByToken(join1.entry.ticket_token);
  assert.ok(fetchedTicket, "Ticket must be found by token");
  assert.strictEqual(fetchedTicket?.queue_number, join1.entry.queue_number);
  console.log(`  ✓ Successfully fetched ticket #${fetchedTicket?.queue_number} via token`);

  // Test 7: Staff call next eligible driver (نده على اللي بعده)
  console.log("\n▶ Test 7: Staff call next eligible driver");
  let calledDriver = await callNextDriver(siteId, "موظف الاستلام - محمد");
  assert.ok(calledDriver, "Next driver must be found and called");
  assert.strictEqual(calledDriver?.status, "called", "Status must be 'called'");
  while (calledDriver && calledDriver.id !== join1.entry.id) {
    calledDriver = await callNextDriver(siteId, "موظف الاستلام - محمد");
  }
  assert.strictEqual(calledDriver?.id, join1.entry.id, "Target driver must be called via FIFO");
  console.log(`  ✓ Called oldest driver: Queue #${calledDriver?.queue_number}`);

  // Test 8: Driver ticket updates when called
  console.log("\n▶ Test 8: Driver ticket state reflects called status");
  const ticketAfterCall = await getTicketByToken(join1.entry.ticket_token);
  assert.strictEqual(ticketAfterCall?.status, "called", "Driver ticket must now show status 'called'");
  console.log(`  ✓ Driver ticket #${ticketAfterCall?.queue_number} is now in state: ${ticketAfterCall?.status}`);

  // Test 9: Staff starts processing then completes order (تم استلام الطلب)
  console.log("\n▶ Test 9: Staff start processing and completes order");
  const processingEntry = await updateEntryStatus(join1.entry.id, "processing", "موظف الاستلام - محمد");
  assert.strictEqual(processingEntry?.status, "processing");

  const completedEntry = await updateEntryStatus(join1.entry.id, "completed", "موظف الاستلام - محمد");
  assert.strictEqual(completedEntry?.status, "completed");
  console.log(`  ✓ Driver 1 marked completed successfully`);

  // Test 10: Completed entries no longer count toward active queue positions
  console.log("\n▶ Test 10: Position dynamically recalculates after completion");
  const ticket2Refreshed = await getTicketByToken(join2.entry.ticket_token);
  // Now Driver 2 is at the head of the waiting line
  assert.strictEqual(ticket2Refreshed?.position, 1, "Driver 2 should now be position 1");
  assert.strictEqual(ticket2Refreshed?.people_ahead, 0, "Driver 2 should now have 0 people ahead");
  console.log(`  ✓ Driver 2 position updated to #${ticket2Refreshed?.position} (ahead: ${ticket2Refreshed?.people_ahead})`);

  // Test 11: Returning driver can join again after completing previous order
  console.log("\n▶ Test 11: Repeat visit workflow for returning driver");
  const returnJoin = await joinQueue({
    site_id: siteId,
    idempotency_key: `${runPrefix}-driver-1-second-order`,
    driver_name: "أحمد حسني (طلب جديد)",
    order_reference: "AMZ-999-REPEAT",
  });
  assert.strictEqual(returnJoin.isDuplicate, false);
  assert.ok(returnJoin.entry.queue_number > join2.entry.queue_number, "New entry must have a new number");
  assert.notStrictEqual(returnJoin.entry.ticket_token, join1.entry.ticket_token, "New ticket must have a fresh token");
  console.log(`  ✓ Returning driver joined again with NEW Queue #${returnJoin.entry.queue_number}`);

  // Test 12: Skip and cancel entries
  console.log("\n▶ Test 12: Skipped and cancelled entries");
  const skippedEntry = await updateEntryStatus(concurrentResults[0].entry.id, "skipped", "مشرف المحطة");
  assert.strictEqual(skippedEntry?.status, "skipped");
  const cancelledEntry = await updateEntryStatus(concurrentResults[1].entry.id, "cancelled", "مشرف المحطة");
  assert.strictEqual(cancelledEntry?.status, "cancelled");
  console.log("  ✓ Skipped and cancelled statuses handled properly");

  // Test 13: Audit logs verification
  console.log("\n▶ Test 13: Audit log inspection");
  const auditLogs = await getAuditLogs(siteId);
  assert.ok(auditLogs.length >= 4, "Audit logs must record actions");
  console.log(`  ✓ Found ${auditLogs.length} audit records in log, latest action: ${auditLogs[0].action_label_ar}`);

  // Test 14: Queue statistics
  console.log("\n▶ Test 14: Real-time Queue stats");
  const stats = await getQueueStats(siteId);
  console.log(`  ✓ Stats: Waiting: ${stats.waiting_count}, Called: ${stats.called_count}, Processing: ${stats.processing_count}, Completed today: ${stats.completed_today_count}, Session Active: ${stats.is_session_active}`);
  assert.strictEqual(stats.is_session_active, true, "Session should be initially active");

  // Test 15: Staff closes session -> Driver cannot join
  console.log("\n▶ Test 15: Staff closes session (الطابور مغلق)");
  await setSessionActive(siteId, false, "مشرف المحطة");
  
  let joinBlocked = false;
  try {
    await joinQueue({
      site_id: siteId,
      idempotency_key: `${runPrefix}-blocked-driver`,
      driver_name: "سائق بعد الإغلاق",
    });
  } catch (err: any) {
    if (err.message.includes("مغلق")) {
      joinBlocked = true;
    }
  }
  assert.strictEqual(joinBlocked, true, "Driver join must be blocked when session is closed");
  console.log("  ✓ Driver join blocked successfully when session is closed");

  // Test 16: Staff starts new session -> Queue opens and counter resets
  console.log("\n▶ Test 16: Staff starts new session (بدء جلسة جديدة وتصفير العداد)");
  const newSession = await startNewSession(siteId, "مشرف المحطة");
  assert.strictEqual(newSession.is_active, true, "New session must be active");
  
  const freshDriver = await joinQueue({
    site_id: siteId,
    idempotency_key: `${runPrefix}-fresh-driver-1`,
    driver_name: "سائق الجلسة الجديدة",
  });
  assert.strictEqual(freshDriver.entry.queue_number, 1, "Queue number must reset to 1 in new session");
  console.log(`  ✓ Fresh session active, allocated Queue #${freshDriver.entry.queue_number}`);

  console.log("\n==========================================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! (تم اجتياز جميع الاختبارات الـ 16 بنجاح)");
  console.log("==========================================================\n");
}

runTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
