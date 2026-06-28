export const cunitFixture = `
CU_pSuite refundSuite = CU_add_suite("RefundSuite", init_suite, clean_suite);
CU_add_test(refundSuite, "negative amount", test_negative_amount);
CU_add_test(refundSuite, "zero amount", test_zero_amount);

static void helper_for_refund(int amount) {
  (void)amount;
}

void test_negative_amount(void) {
  helper_for_refund(-1);
  CU_ASSERT_FALSE(apply_refund(-1));
}

void test_zero_amount(void) {
  CU_ASSERT_TRUE(apply_refund(0));
}
`;

export const cunitRegistrationOnlyFixture = `
CU_pSuite refundSuite = CU_add_suite("RefundSuite", init_suite, clean_suite);
CU_add_test(refundSuite, "negative amount", test_negative_amount);
`;