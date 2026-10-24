import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:asia_lecture_grabber/backend/asia_api.dart';
import 'package:asia_lecture_grabber/config/school_certs.dart';

void main() {
  group('AsiaApi TLS 驗證設定', () {
    test('校方中繼憑證可載入 SecurityContext', () {
      expect(schoolIntermediatePem, contains('BEGIN CERTIFICATE'));
      final context = buildSchoolSecurityContext();
      expect(context, isA<SecurityContext>());
    });

    test('AsiaApi 使用預設校方網址建立', () {
      final api = AsiaApi();
      expect(api.baseUrl, equals(AsiaApi.defaultBaseUrl));
    });
  });
}
