package com.example.b2glab.web;
import com.example.b2glab.legacy.LegacyAtamSender; import com.example.b2glab.legacy.LegacyTelecopSender; import com.example.b2glab.stub.PartnerStubServer;
import java.io.IOException; import java.util.Collections; import java.util.Map;
import org.springframework.web.bind.annotation.PathVariable; import org.springframework.web.bind.annotation.PostMapping; import org.springframework.web.bind.annotation.RequestParam; import org.springframework.web.bind.annotation.RestController;
@RestController
public class LegacyLabController {
    private final LegacyTelecopSender telecop; private final LegacyAtamSender atam; private final PartnerStubServer stub;
    public LegacyLabController(LegacyTelecopSender telecop, LegacyAtamSender atam, PartnerStubServer stub) { this.telecop = telecop; this.atam = atam; this.stub = stub; }
    @PostMapping("/lab/legacy/{partner}/{behavior}")
    public Map<String,Boolean> send(@PathVariable String partner, @PathVariable String behavior, @RequestParam(defaultValue="30000") int timeoutMs) throws IOException {
        boolean success = "atam".equalsIgnoreCase(partner) ? atam.send(stub.url(behavior), timeoutMs) : telecop.send(stub.url(behavior), timeoutMs);
        return Collections.singletonMap("success", success);
    }
}
