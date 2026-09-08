package com.example.b2glab.web;
import com.example.b2glab.legacy.LegacyPartnerBSender; import com.example.b2glab.legacy.LegacyPartnerASender; import com.example.b2glab.stub.PartnerStubServer;
import java.io.IOException; import java.util.Collections; import java.util.Map;
import org.springframework.web.bind.annotation.PathVariable; import org.springframework.web.bind.annotation.PostMapping; import org.springframework.web.bind.annotation.RequestParam; import org.springframework.web.bind.annotation.RestController;
@RestController
public class LegacyLabController {
    private final LegacyPartnerASender partnera; private final LegacyPartnerBSender partnerb; private final PartnerStubServer stub;
    public LegacyLabController(LegacyPartnerASender partnera, LegacyPartnerBSender partnerb, PartnerStubServer stub) { this.partnera = partnera; this.partnerb = partnerb; this.stub = stub; }
    @PostMapping("/lab/legacy/{partner}/{behavior}")
    public Map<String,Boolean> send(@PathVariable String partner, @PathVariable String behavior, @RequestParam(defaultValue="30000") int timeoutMs) throws IOException {
        boolean success = "partnerb".equalsIgnoreCase(partner) ? partnerb.send(stub.url(behavior), timeoutMs) : partnera.send(stub.url(behavior), timeoutMs);
        return Collections.singletonMap("success", success);
    }
}
