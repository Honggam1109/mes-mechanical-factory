// src/config.ts

// File này lưu trữ toàn bộ mã màu, kích thước và khoảng cách. Khi cần thay đổi giao diện, chỉ cần sửa ở đây.

export const AppConfig = {
  theme: {
    light: {
      colors: {
        primary: "#079095", // Màu chủ đạo (Nút Primary, Nền Login, Tab active): #079095-Xanh | #B11823-Đỏ

        secondary: "#ffffff", // Màu phụ (Nút Secondary, Nút Hủy)

        secondaryText: "#595959", // Chữ trên nút Secondary

        bgLayout: "#f5f5f5", // Màu nền tổng thể ngoài cùng

        bgContainer: "#ffffff", // Màu nền các thẻ Card, Form, Sidebar

        bgHeader: "#ffffff", // Màu nền thanh Header

        borderColor: "#e8e8e8", // Viền phân cách và các khối nội dung
      },

      layout: {
        filterGap: 24,

        sectionGap: 16,

        toolbarGap: 8,

        sectionTitleSize: 16,

        borderRadius: 6, // Độ bo góc chuẩn cho nút và ô nhập liệu

        cardBorderRadius: 8, // Độ bo góc cho các khối Card lớn
      },
    },
  },
}
