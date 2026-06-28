export const gtestFixture = `
// gtest sample fixture
TEST(MathUtilTest, HandlesOverflow) {
  const char* text = "brace in string { should not break parser }";
  EXPECT_EQ(add_with_overflow(INT_MAX, 1), -1);
  EXPECT_NE(text, nullptr);
}

TEST_F(RefundServiceTest, RejectsNegativeAmount) {
  // comment with } should not break parsing
  EXPECT_FALSE(service.Apply(-1));
}
`;